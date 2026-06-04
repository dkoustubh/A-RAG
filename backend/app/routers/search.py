from fastapi import APIRouter, Depends
from app.services.chat_service import ChatService
from app.security import verify_employee
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/search", tags=["search"])

class QueryRequest(BaseModel):
    query: str
    document_id: Optional[int] = None
    session_id: Optional[str] = None

class QueryResponse(BaseModel):
    answer: str
    confidence: str
    sources: List[str]
    graph_nodes_used: List[str]
    fact_count: int
    graph_count: int

@router.post("/query", response_model=QueryResponse)
def search_query(req: QueryRequest, current_user = Depends(verify_employee)):
    """
    Executes reasoning search using Query Routing rules.
    """
    result = ChatService.execute_chat_query(
        query=req.query,
        document_id=req.document_id,
        session_id=req.session_id,
        user_id=current_user.id,
        role=current_user.role
    )
    return result

