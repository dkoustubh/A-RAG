from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.postgres import get_db
from app.database.models import Document, DocumentMetadata, ExtractedTable, Fact, TimelineEvent
from app.security import verify_employee, verify_manager
from typing import List

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("/")
def get_documents(db: Session = Depends(get_db), current_user = Depends(verify_employee)):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return [{"id": d.id, "location": d.location, "file_type": d.file_type, "industry": d.industry, "created_at": d.created_at, "search_ready": d.search_ready} for d in docs]

@router.get("/{doc_id}")
def get_document_details(doc_id: int, db: Session = Depends(get_db), current_user = Depends(verify_employee)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    metadata = db.query(DocumentMetadata).filter(DocumentMetadata.document_id == doc_id).all()
    tables = db.query(ExtractedTable).filter(ExtractedTable.document_id == doc_id).all()
    facts = db.query(Fact).filter(Fact.document_id == doc_id).all()
    events = db.query(TimelineEvent).filter(TimelineEvent.document_id == doc_id).all()
    
    return {
        "id": doc.id,
        "text": doc.text[:5000] + ("..." if len(doc.text) > 5000 else ""), # Truncate for API performance
        "location": doc.location,
        "industry": doc.industry,
        "metadata": [{"client_name": m.client_name, "class": m.class_, "format": m.format, "year": m.year} for m in metadata],
        "tables": [{"title": t.title, "caption": t.caption, "headers": t.headers} for t in tables],
        "facts": [{"subject": f.subject, "predicate": f.predicate, "object": f.object, "confidence": f.confidence} for f in facts],
        "timeline_events": [{"date": e.event_date, "description": e.description} for e in events]
    }

@router.delete("/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db), current_user = Depends(verify_manager)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.delete(doc)
    db.commit()
    return {"message": f"Document {doc_id} deleted successfully."}
