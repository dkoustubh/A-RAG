from fastapi import APIRouter, Depends
from app.services.chat_service import ChatService
from app.security import verify_employee
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/search", tags=["search"])

class QueryRequest(BaseModel):
    query: str
    document_id: Optional[int] = None

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
    result = ChatService.execute_chat_query(req.query, req.document_id)
    return result
