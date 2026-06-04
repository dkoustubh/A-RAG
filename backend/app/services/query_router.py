from typing import Dict, Any

class QueryRouter:
    @staticmethod
    def route_query(query: str) -> Dict[str, Any]:
        """
        Routes the natural language query to the appropriate data repository.
        Follows a strict prioritization rule: SQL > Graph > Fact Store > Semantic.
        """
        q_lower = query.lower()
        
        # 1. SQL Heuristic
        sql_keywords = ["how many", "count", "list of", "average", "sum of", "total", "who is the admin", "show all users", "list documents"]
        for kw in sql_keywords:
            if kw in q_lower:
                return {
                    "route": "sql",
                    "reason": f"Query matches SQL keyword template: '{kw}'",
                    "confidence": 1.0
                }
                
        # 2. Neo4j Graph Heuristic
        graph_keywords = ["relationship", "connected", "which customer", "which vendor", "who sent", "who received", "related to", "quoted lowest", "part of"]
        for kw in graph_keywords:
            if kw in q_lower:
                return {
                    "route": "graph",
                    "reason": f"Query matches Graph keyword template: '{kw}'",
                    "confidence": 0.95
                }
                
        # 3. Fact Store Heuristic
        fact_keywords = ["payload", "cycle time", "specification", "warranty", "dimension", "part number", "exact value", "what is the speed"]
        for kw in fact_keywords:
            if kw in q_lower:
                return {
                    "route": "fact_store",
                    "reason": f"Query matches Fact Store keyword template: '{kw}'",
                    "confidence": 0.90
                }
                
        # 4. Fallback to Semantic (Qdrant)
        return {
            "route": "semantic",
            "reason": "Query requires semantic semantic lookup or summarization",
            "confidence": 0.70
        }

query_router = QueryRouter()
