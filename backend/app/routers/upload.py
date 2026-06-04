from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.services.ingestion import IngestionPipeline
from app.workers.tasks import deep_extraction_task
from app.security import verify_employee
from app.database.models import User
import asyncio

router = APIRouter(prefix="/upload", tags=["upload"])

@router.post("/")
async def upload_document(file: UploadFile = File(...), current_user: User = Depends(verify_employee)):
    """
    Ingests files immediately (< 5s target) and schedules deep extraction background tasks.
    Attaches owner_id and team_id for RBAC workspace isolation.
    """
    file_bytes = await file.read()
    
    try:
        # Run on asyncio thread pool to keep fastapi responsive
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            IngestionPipeline.ingest_immediate,
            file.filename,
            file_bytes,
            current_user.id,
            current_user.team_id
        )
        
        # Schedule Deep parsing & extraction asynchronously via Celery
        deep_extraction_task.delay(
            result["document_id"],
            file_bytes,
            file.filename
        )
        
        return {
            "message": "Document uploaded and indexed successfully.",
            "document_id": result["document_id"],
            "status": "search_ready",
            "duration_seconds": result["duration_seconds"],
            "chunks_count": result["chunks_count"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
