from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.postgres import get_db
from app.database.models import ProcessingJob
from app.security import verify_employee

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

@router.get("/status/{doc_id}")
def get_pipeline_status(doc_id: int, db: Session = Depends(get_db), current_user = Depends(verify_employee)):
    """
    Returns pipeline statuses for real-time visualization of ingestion phases.
    """
    jobs = db.query(ProcessingJob).filter(ProcessingJob.document_id == doc_id).order_by(ProcessingJob.updated_at.desc()).all()
    if not jobs:
        raise HTTPException(status_code=404, detail="Ingestion jobs not found for this document")
        
    stages_status = {
        "storage": "pending",
        "extraction": "pending",
        "knowledge": "pending",
        "graph": "pending",
        "search": "pending",
        "intelligence": "pending"
    }
    
    stages_order = ["storage", "extraction", "knowledge", "graph", "search", "intelligence"]
    
    # Process job sequence
    latest_job = jobs[0]
    current_stage = latest_job.stage
    status = latest_job.status
    
    for stage in stages_order:
        if stages_order.index(stage) < stages_order.index(current_stage):
            stages_status[stage] = "completed"
        elif stage == current_stage:
            stages_status[stage] = status
            
    return {
        "document_id": doc_id,
        "stages": stages_status,
        "error_message": latest_job.error_message,
        "updated_at": latest_job.updated_at
    }
