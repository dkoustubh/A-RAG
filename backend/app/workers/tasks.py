from app.workers.celery_app import celery_app
from app.services.ingestion import IngestionPipeline
from app.services.extraction import DeepExtractor
from app.services.graph_service import graph_sync_service
from app.services.nas_sync import nas_sync_service
from app.database.postgres import SessionLocal
from app.database.models import ProcessingJob

@celery_app.task
def high_priority_ingest(filename: str, file_bytes: bytes):
    """
    Asynchronous runner for quick search-ready ingestion.
    """
    return IngestionPipeline.ingest_immediate(filename, file_bytes)

@celery_app.task
def deep_extraction_task(document_id: int, file_bytes: bytes, filename: str):
    """
    Extracts deep metadata, tables, entities, facts, and updates Neo4j relationships.
    """
    db = SessionLocal()
    try:
        # Update job status
        job = db.query(ProcessingJob).filter(
            ProcessingJob.document_id == document_id,
            ProcessingJob.stage == "search"
        ).first()
        if job:
            job.status = "processing"
            job.stage = "extraction"
            db.commit()
            
        # Run extraction
        DeepExtractor.run_deep_extraction(document_id, file_bytes, filename)
        
        # Sync relations to Neo4j
        graph_sync_service.sync_document_relations(document_id)
        
        if job:
            job.status = "completed"
            job.stage = "intelligence"
            db.commit()
            
        # Trigger NAS sync asynchronously
        async_nas_sync_task.delay(filename, file_bytes)
        
    except Exception as e:
        db.rollback()
        if job:
            job.status = "failed"
            job.error_message = str(e)
            db.commit()
        raise e
    finally:
        db.close()

@celery_app.task
def async_nas_sync_task(filename: str, file_bytes: bytes):
    """
    Synchronizes file to NAS archive asynchronously.
    """
    # 1. Sync to NAS
    nas_sync_service.sync_to_nas(filename, file_bytes)
    # 2. Save locally in hot cache
    nas_sync_service.cache_hot_data(filename, file_bytes)
    # 3. Clean up cache if exceeding files limit
    nas_sync_service.cleanup_hot_cache()
    return f"File {filename} archived successfully to NAS."
