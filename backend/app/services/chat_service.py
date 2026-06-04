import requests
from typing import Dict, Any, List, Optional
from app.config import settings
from app.database.postgres import SessionLocal
from app.database.models import Document, Fact, RFQ, Customer, Vendor, Project
from app.database.neo4j import neo4j_client
from app.database.qdrant import qdrant_client
from app.services.query_router import query_router
from app.services.ingestion import embedding_model

class ChatService:
    @staticmethod
    def query_vllm(prompt: str) -> str:
        """
        Sends reasoning and generation tasks to the local Gemma model via vLLM.
        """
        try:
            payload = {
                "model": settings.MODEL_NAME,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 1024
            }
            response = requests.post(
                f"{settings.OPENAI_API_BASE}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                timeout=30
            )
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            else:
                return f"Error from AI service: {response.text}"
        except Exception as e:
            return f"Error contacting AI service: {str(e)}"

    @classmethod
    def execute_chat_query(cls, query: str, document_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Main query execution engine. Uses deterministic databases before LLM generation.
        """
        route_info = query_router.route_query(query)
        route = route_info["route"]
        
        db = SessionLocal()
        answer = ""
        confidence = 1.0
        sources = []
        graph_nodes = []
        fact_count = 0
        graph_count = 0
        
        try:
            if route == "sql":
                # Execute simple SQL query or map rules
                q_lower = query.lower()
                if "how many rfq" in q_lower or "count rfq" in q_lower:
                    if document_id:
                        count = db.query(RFQ).filter(RFQ.document_id == document_id).count()
                        answer = f"Total number of RFQs in this document is {count}."
                    else:
                        count = db.query(RFQ).count()
                        answer = f"Total number of RFQs is {count}."
                    sources.append("PostgreSQL: rfqs table")
                elif "how many document" in q_lower or "count document" in q_lower:
                    count = db.query(Document).count()
                    answer = f"Total number of ingested documents is {count}."
                    sources.append("PostgreSQL: documents table")
                elif "list document" in q_lower or "show document" in q_lower:
                    docs = db.query(Document).limit(10).all()
                    doc_list = "\n".join([f"- {d.location} (ID: {d.id})" for d in docs])
                    answer = f"Here are the recent documents:\n{doc_list}"
                    sources.extend([f"PostgreSQL: documents table (ID: {d.id})" for d in docs])
                else:
                    # Let Gemma translate schema to read-only SQL
                    schema = """
                    Tables:
                    - documents (id, text, location, client_name, year, industry, file_type, created_at)
                    - rfqs (id, document_id, rfq_number, customer_id, project_id, status)
                    - bom (id, document_id, rfq_id, part_number, description, quantity)
                    - customers (id, name, code)
                    - vendors (id, name, code)
                    - projects (id, name, status, budget)
                    """
                    prompt = f"Given this PostgreSQL schema:\n{schema}\nWrite a read-only SELECT SQL query for: '{query}'. "
                    if document_id:
                        prompt += f"IMPORTANT: You MUST filter the query using 'WHERE document_id = {document_id}' to only search inside this document. "
                    prompt += "Return ONLY the SQL query code block and nothing else."
                    sql_query = cls.query_vllm(prompt)
                    # Clean markdown blocks
                    sql_query = sql_query.replace("```sql", "").replace("```", "").strip()
                    if sql_query.lower().startswith("select"):
                        res = db.execute(sql_query)
                        rows = res.fetchall()
                        answer = f"SQL Result:\n" + "\n".join([str(r) for r in rows])
                        sources.append("PostgreSQL Query")
                    else:
                        answer = "Could not translate request to valid SQL query."
                        confidence = 0.0

            elif route == "graph":
                # Run Neo4j relationships lookup
                # Find if any entity matches a name
                words = [w.strip("?,.!") for w in query.split()]
                matched_nodes = []
                for w in words:
                    if len(w) > 3 and w.lower() not in ["what", "when", "where", "which", "show", "list", "with"]:
                        if document_id:
                            res = neo4j_client.execute_read(
                                "MATCH (n {name: $name})-[r]->(m) WHERE r.doc_id = $doc_id RETURN n.name AS source, type(r) AS rel, m.name AS target",
                                {"name": w, "doc_id": document_id}
                            )
                        else:
                            res = neo4j_client.execute_read(
                                "MATCH (n {name: $name})-[r]->(m) RETURN n.name AS source, type(r) AS rel, m.name AS target",
                                {"name": w}
                            )
                        if res:
                            matched_nodes.extend(res)
                
                if matched_nodes:
                    relations_text = "\n".join([f"- {r['source']} -[{r['rel']}]-> {r['target']}" for r in matched_nodes])
                    answer = f"Found the following relationships in the Knowledge Graph:\n{relations_text}"
                    sources.extend([f"Neo4j: {r['source']} to {r['target']}" for r in matched_nodes])
                    graph_nodes = list(set([r['source'] for r in matched_nodes] + [r['target'] for r in matched_nodes]))
                    graph_count = len(matched_nodes)
                else:
                    # Traversal matching
                    if document_id:
                        res = neo4j_client.execute_read(
                            "MATCH (n)-[r]->(m) WHERE r.doc_id = $doc_id RETURN n.name AS source, type(r) AS rel, m.name AS target LIMIT 10",
                            {"doc_id": document_id}
                        )
                    else:
                        res = neo4j_client.execute_read("MATCH (n)-[r]->(m) RETURN n.name AS source, type(r) AS rel, m.name AS target LIMIT 10")
                    relations_text = "\n".join([f"- {r['source']} -[{r['rel']}]-> {r['target']}" for r in res])
                    answer = f"No direct node matched. Here is a view of the general graph relationships:\n{relations_text}"
                    sources.append("Neo4j General Schema")

            elif route == "fact_store":
                # Check facts in Postgres
                words = [w.strip("?,.!") for w in query.split()]
                matched_facts = []
                for w in words:
                    if len(w) > 3 and w.lower() not in ["what", "when", "where", "which", "show", "list", "with"]:
                        if document_id:
                            facts = db.query(Fact).filter(
                                Fact.document_id == document_id,
                                ((Fact.subject.ilike(f"%{w}%")) | (Fact.object.ilike(f"%{w}%")))
                            ).all()
                        else:
                            facts = db.query(Fact).filter(
                                (Fact.subject.ilike(f"%{w}%")) | (Fact.object.ilike(f"%{w}%"))
                            ).all()
                        matched_facts.extend(facts)
                
                if matched_facts:
                    facts_text = "\n".join([f"- {f.subject} {f.predicate} {f.object} (confidence: {f.confidence})" for f in matched_facts])
                    answer = f"Fact Store evidence:\n{facts_text}"
                    sources.extend([f"PostgreSQL Fact: ID {f.id}" for f in matched_facts])
                    fact_count = len(matched_facts)
                    confidence = sum([f.confidence for f in matched_facts]) / len(matched_facts)
                else:
                    answer = "Insufficient evidence found."
                    confidence = 0.0

            else:
                # Semantic / Fallback
                from qdrant_client.http import models as qdrant_models
                query_filter = None
                if document_id:
                    query_filter = qdrant_models.Filter(
                        must=[
                            qdrant_models.FieldCondition(
                                key="document_id",
                                match=qdrant_models.MatchValue(value=document_id)
                            )
                        ]
                    )
                
                vector = embedding_model.encode(query).tolist()
                results = qdrant_client.search_points("documents", vector, limit=3, query_filter=query_filter)
                
                if results:
                    contexts = []
                    for r in results:
                        contexts.append(r.payload["parent_text"])
                        sources.append(f"Qdrant Document Chunk (Doc ID: {r.payload['document_id']})")
                    
                    context_str = "\n---\n".join(contexts)
                    prompt = f"Answer the user query based ONLY on the context below. If you cannot answer it, reply 'Insufficient evidence found.'\n\nContext:\n{context_str}\n\nQuery: {query}\n\nAnswer:"
                    answer = cls.query_vllm(prompt)
                    confidence = 0.82
                else:
                    answer = "Insufficient evidence found."
                    confidence = 0.0
            
            return {
                "answer": answer,
                "confidence": f"{int(confidence * 100)}%",
                "sources": list(set(sources)),
                "graph_nodes_used": graph_nodes,
                "fact_count": fact_count,
                "graph_count": graph_count
            }
        except Exception as e:
            return {
                "answer": f"Retrieval error: {str(e)}",
                "confidence": "0%",
                "sources": [],
                "graph_nodes_used": [],
                "fact_count": 0,
                "graph_count": 0
            }
        finally:
            db.close()
