import os
import uuid
from typing import Dict, Any, List
from datetime import datetime
from pypdf import PdfReader
from docx import Document as DocxDocument
from pptx import Presentation as PptxPresentation
from sentence_transformers import SentenceTransformer
from qdrant_client.http import models as qdrant_models
from app.config import settings
from app.database.postgres import SessionLocal
from app.database.models import Document, ProcessingJob, DocumentMetadata
from app.database.minio import minio_client
from app.database.qdrant import qdrant_client
from app.services.knowledge_router import knowledge_router

# Load SentenceTransformer model once on service initialization
embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL, device=settings.EMBEDDING_DEVICE)
# Set dimension dynamically
qdrant_client.init_collections(vector_size=embedding_model.get_sentence_embedding_dimension())

class IngestionPipeline:
    @staticmethod
    def extract_text_fast(file_bytes: bytes, filename: str) -> str:
        """
        Extracts raw text as fast as possible from common file formats.
        """
        _, ext = os.path.splitext(filename.lower())
        text = ""
        try:
            if ext == ".txt":
                text = file_bytes.decode("utf-8", errors="ignore")
            elif ext == ".pdf":
                reader = PdfReader(io_bytes := io_stream(file_bytes))
                text_list = [page.extract_text() or "" for page in reader.pages]
                text = "\n".join(text_list)
            elif ext == ".docx":
                doc = DocxDocument(io_stream(file_bytes))
                text = "\n".join([para.text for para in doc.paragraphs])
            elif ext == ".pptx":
                prs = PptxPresentation(io_stream(file_bytes))
                text_list = []
                for slide in prs.slides:
                    for shape in slide.shapes:
                        if hasattr(shape, "text"):
                            text_list.append(shape.text)
                text = "\n".join(text_list)
            else:
                text = f"Fast-parsed content for binary file {filename}"
        except Exception as e:
            text = f"Extraction error: {str(e)}"
        return text or "Empty document text"

    @staticmethod
    def create_chunks(text: str, parent_size: int = 8000, child_size: int = 2000) -> List[Dict[str, Any]]:
        """
        Splits text into parent chunks (1500-2500 tokens / 8000 chars)
        and nested child chunks (400-800 tokens / 2000 chars) with metadata-aware alignment.
        """
        chunks = []
        i = 0
        while i < len(text):
            parent_id = str(uuid.uuid4())
            parent_chunk = text[i : i + parent_size]
            
            # Create child chunks within this parent
            j = 0
            while j < len(parent_chunk):
                child_id = str(uuid.uuid4())
                child_chunk = parent_chunk[j : j + child_size]
                chunks.append({
                    "id": child_id,
                    "parent_id": parent_id,
                    "text": child_chunk,
                    "parent_text": parent_chunk,
                    "is_child": True
                })
                j += child_size - 400 # 400 chars overlap
                
            i += parent_size - 1000 # 1000 chars overlap
        return chunks

    @classmethod
    def ingest_immediate(cls, filename: str, file_bytes: bytes) -> Dict[str, Any]:
        """
        Immediate ingestion path (< 5s target).
        """
        start_time = datetime.utcnow()
        
        # 1. Upload original file to MinIO
        object_name = f"originals/{uuid.uuid4()}-{filename}"
        minio_client.upload_file(
            object_name=object_name,
            file_data=file_bytes,
            content_length=len(file_bytes)
        )
        
        # 2. Get quick text parsing & classification routing
        strategy = knowledge_router.route_document(filename, file_bytes)
        raw_text = cls.extract_text_fast(file_bytes, filename)
        
        # 3. Create document entries in Postgres
        db = SessionLocal()
        try:
            document = Document(
                text=raw_text,
                location=object_name,
                file_type=strategy["format"],
                industry=strategy["class"],
                search_ready=False
            )
            db.add(document)
            db.commit()
            db.refresh(document)
            
            # Create initial metadata entry
            meta_entry = DocumentMetadata(
                document_id=document.id,
                source_of_file=object_name,
                class_=strategy["class"],
                format=strategy["format"]
            )
            db.add(meta_entry)
            
            # Create Ingestion Processing Job
            job = ProcessingJob(
                document_id=document.id,
                status="processing",
                stage="storage"
            )
            db.add(job)
            db.commit()
            db.refresh(job)
            
            # 4. Generate quick parent-child chunks and Embed
            chunks = cls.create_chunks(raw_text)
            points = []
            for chunk in chunks:
                vector = embedding_model.encode(chunk["text"]).tolist()
                points.append(
                    qdrant_models.PointStruct(
                        id=chunk["id"],
                        vector=vector,
                        payload={
                            "document_id": document.id,
                            "parent_id": chunk["parent_id"],
                            "text": chunk["text"],
                            "parent_text": chunk["parent_text"],
                            "class": strategy["class"],
                            "created_at": datetime.utcnow().isoformat()
                        }
                    )
                )
            
            # Upsert vectors to Qdrant
            if points:
                qdrant_client.upsert_points("documents", points)
                
            # Update Document Search Ready status
            document.search_ready = True
            job.status = "completed"
            job.stage = "search"
            db.commit()
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            return {
                "document_id": document.id,
                "job_id": job.id,
                "status": "search_ready",
                "duration_seconds": duration,
                "chunks_count": len(chunks)
            }
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

def io_stream(file_bytes: bytes) -> Any:
    import io
    return io.BytesIO(file_bytes)
