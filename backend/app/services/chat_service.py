import re
import json
import hashlib
import requests
from typing import Dict, Any, List, Optional
from app.config import settings
from app.database.postgres import SessionLocal
from app.database.models import Document, Fact, RFQ, Customer, Vendor, Project, BOM, Summary, ChatMessage, User
from app.database.neo4j import neo4j_client
from app.database.qdrant import qdrant_client
from app.services.query_router import query_router
from app.services.ingestion import embedding_model
from app.services.token_governance import TokenGovernance
import redis

# Persistent chat history cache in Redis
_redis = None
def get_redis():
    global _redis
    if _redis is None:
        try:
            _redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
            _redis.ping()
        except Exception:
            _redis = None
    return _redis

CACHE_PREFIX = "chat:history:"
CACHE_TTL = 60 * 60 * 24 * 7  # 7 days


class ChatService:
    # ------------------------------------------------------------------ #
    #  LLM Interface                                                      #
    # ------------------------------------------------------------------ #
    @staticmethod
    def query_vllm(prompt: str, max_tokens: int = 1024) -> str:
        """
        Sends reasoning and generation tasks to the local Gemma model via vLLM.
        """
        try:
            payload = {
                "model": settings.MODEL_NAME,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": max_tokens
            }
            response = requests.post(
                f"{settings.OPENAI_API_BASE}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                timeout=60
            )
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            else:
                return f"Error from AI service: {response.text}"
        except Exception as e:
            return f"Error contacting AI service: {str(e)}"

    # ------------------------------------------------------------------ #
    #  Cache helpers                                                       #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _cache_key(query: str, document_id: Optional[int] = None) -> str:
        """Create a deterministic cache key from the query + optional document scope."""
        normalized = re.sub(r'\s+', ' ', query.lower().strip())
        raw = f"{normalized}|doc={document_id or 'global'}"
        return CACHE_PREFIX + hashlib.sha256(raw.encode()).hexdigest()[:24]

    @staticmethod
    def _cache_get(key: str) -> Optional[Dict]:
        r = get_redis()
        if not r:
            return None
        try:
            val = r.get(key)
            if val:
                return json.loads(val)
        except Exception:
            pass
        return None

    @staticmethod
    def _cache_set(key: str, value: Dict):
        r = get_redis()
        if not r:
            return
        try:
            r.setex(key, CACHE_TTL, json.dumps(value))
        except Exception:
            pass

    # ------------------------------------------------------------------ #
    #  RBAC Allowed Documents resolver                                     #
    # ------------------------------------------------------------------ #
    @classmethod
    def _get_allowed_doc_ids(cls, user_id: Optional[int], role: Optional[str], db) -> Optional[List[int]]:
        """
        Resolves the set of document IDs that the user is allowed to access.
        Returns None for admin (unrestricted), or a list of integers for other roles.
        """
        if not user_id or role == "admin":
            return None # Admin has access to all documents
            
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return []
            
        from sqlalchemy import or_
        conditions = [Document.owner_id == user_id]
        if user.team_id:
            conditions.append(Document.team_id == user.team_id)
            
        docs = db.query(Document).filter(or_(*conditions)).all()
        return [d.id for d in docs]

    # ------------------------------------------------------------------ #
    #  Evidence Collectors (one per data source)                           #
    # ------------------------------------------------------------------ #
    @classmethod
    def _collect_sql_evidence(cls, query: str, document_id: Optional[int], allowed_doc_ids: Optional[List[int]], db) -> Dict[str, Any]:
        """Search PostgreSQL structured tables for direct answers."""
        evidence = {"source": "PostgreSQL", "passages": [], "answer_fragment": None}
        q_lower = query.lower()

        if allowed_doc_ids is not None:
            if document_id and document_id not in allowed_doc_ids:
                return evidence # Scoped to an unauthorized document!

        try:
            # --- Document name/existence search ---
            doc_name_match = re.search(
                r'(?:document|file)\s+(?:named|called|titled)\s+["\']?(\w[\w\s\-.()]*)',
                q_lower
            )
            # Also catch patterns like "named ELITEHUBS" or just a capitalized/uppercased word
            if not doc_name_match:
                doc_name_match = re.search(r'named\s+["\']?(\w[\w\s\-.()]*)', q_lower)

            if doc_name_match:
                search_term = doc_name_match.group(1).strip().rstrip('?.,!')
                doc_q = db.query(Document).filter(Document.location.ilike(f"%{search_term}%"))
                if allowed_doc_ids is not None:
                    doc_q = doc_q.filter(Document.id.in_(allowed_doc_ids))
                docs = doc_q.all()
                if not docs:
                    # Also search in document text
                    doc_q_text = db.query(Document).filter(Document.text.ilike(f"%{search_term}%"))
                    if allowed_doc_ids is not None:
                        doc_q_text = doc_q_text.filter(Document.id.in_(allowed_doc_ids))
                    docs = doc_q_text.limit(5).all()
                if docs:
                    doc_list = "\n".join([f"- {d.location} (ID: {d.id}, Type: {d.file_type})" for d in docs])
                    evidence["answer_fragment"] = f"Yes, found {len(docs)} document(s) matching '{search_term}':\n{doc_list}"
                    evidence["passages"].extend([f"PostgreSQL: documents table (ID: {d.id})" for d in docs])
                else:
                    evidence["answer_fragment"] = f"No documents found matching '{search_term}' in the database."
                    evidence["passages"].append("PostgreSQL: documents table (no match)")
                return evidence

            # --- RFQ count ---
            if "how many rfq" in q_lower or "count rfq" in q_lower:
                if document_id:
                    count = db.query(RFQ).filter(RFQ.document_id == document_id).count()
                    evidence["answer_fragment"] = f"Total RFQs in this document: {count}"
                else:
                    rfq_q = db.query(RFQ)
                    if allowed_doc_ids is not None:
                        rfq_q = rfq_q.filter(RFQ.document_id.in_(allowed_doc_ids))
                    count = rfq_q.count()
                    evidence["answer_fragment"] = f"Total RFQs in database: {count}"
                evidence["passages"].append("PostgreSQL: rfqs table")
                return evidence

            # --- Document count ---
            if "how many document" in q_lower or "count document" in q_lower:
                doc_q = db.query(Document)
                if allowed_doc_ids is not None:
                    doc_q = doc_q.filter(Document.id.in_(allowed_doc_ids))
                count = doc_q.count()
                evidence["answer_fragment"] = f"Total ingested documents: {count}"
                evidence["passages"].append("PostgreSQL: documents table")
                return evidence

            # --- List documents ---
            if "list document" in q_lower or "show document" in q_lower or "list all document" in q_lower:
                doc_q = db.query(Document).order_by(Document.id.desc())
                if allowed_doc_ids is not None:
                    doc_q = doc_q.filter(Document.id.in_(allowed_doc_ids))
                docs = doc_q.limit(15).all()
                doc_list = "\n".join([f"- {d.location or 'Untitled'} (ID: {d.id}, Type: {d.file_type or 'unknown'})" for d in docs])
                evidence["answer_fragment"] = f"Documents in the database ({len(docs)} shown):\n{doc_list}"
                evidence["passages"].extend([f"PostgreSQL: documents table (ID: {d.id})" for d in docs])
                return evidence

            # --- Vendor name queries ---
            if "vendor" in q_lower and ("name" in q_lower or "list" in q_lower or "who" in q_lower or "what" in q_lower):
                vendors = db.query(Vendor).limit(20).all()
                if vendors:
                    vendor_list = "\n".join([f"- {v.name} (Code: {v.code or 'N/A'})" for v in vendors])
                    evidence["answer_fragment"] = f"Vendors found:\n{vendor_list}"
                    evidence["passages"].extend([f"PostgreSQL: vendors table (ID: {v.id})" for v in vendors])
                return evidence

            # --- Customer name queries ---
            if "customer" in q_lower and ("name" in q_lower or "list" in q_lower or "who" in q_lower or "what" in q_lower):
                customers = db.query(Customer).limit(20).all()
                if customers:
                    cust_list = "\n".join([f"- {c.name} (Code: {c.code or 'N/A'})" for c in customers])
                    evidence["answer_fragment"] = f"Customers found:\n{cust_list}"
                    evidence["passages"].extend([f"PostgreSQL: customers table (ID: {c.id})" for c in customers])
                return evidence

            # --- BOM queries ---
            if "bom" in q_lower or "bill of material" in q_lower or "part" in q_lower:
                if document_id:
                    boms = db.query(BOM).filter(BOM.document_id == document_id).limit(20).all()
                else:
                    bom_q = db.query(BOM)
                    if allowed_doc_ids is not None:
                        bom_q = bom_q.filter(BOM.document_id.in_(allowed_doc_ids))
                    boms = bom_q.limit(20).all()
                if boms:
                    bom_list = "\n".join([f"- Part: {b.part_number}, Desc: {b.description or 'N/A'}, Qty: {b.quantity}" for b in boms])
                    evidence["answer_fragment"] = f"BOM items:\n{bom_list}"
                    evidence["passages"].extend([f"PostgreSQL: bom table (ID: {b.id})" for b in boms])
                return evidence

            # --- Generic: search document text for keywords ---
            stop_words = {"what", "is", "the", "a", "an", "in", "of", "for", "to", "and", "or", "are",
                          "there", "any", "do", "we", "have", "can", "you", "tell", "me", "about",
                          "how", "many", "show", "list", "find", "search", "this", "that", "with",
                          "from", "by", "on", "at", "be", "was", "were", "been", "has", "had"}
            words = [w.strip("?.,!\"'()") for w in query.split()]
            keywords = [w for w in words if len(w) > 2 and w.lower() not in stop_words]

            if keywords:
                doc_q = db.query(Document)
                if document_id:
                    doc_q = doc_q.filter(Document.id == document_id)
                elif allowed_doc_ids is not None:
                    doc_q = doc_q.filter(Document.id.in_(allowed_doc_ids))
                
                docs = doc_q.limit(10).all()
                matched_lines = []
                for doc in docs:
                    if doc.text:
                        for line in doc.text.split('\n'):
                            if any(kw.lower() in line.lower() for kw in keywords):
                                matched_lines.append(f"({doc.location}): {line.strip()}")
                if matched_lines:
                    evidence["passages"].append(f"PostgreSQL: documents text search")
                    evidence["answer_fragment"] = "Relevant lines from documents:\n" + "\n".join(matched_lines[:10])

        except Exception as e:
            evidence["passages"].append(f"SQL search error: {str(e)}")

        return evidence

    @classmethod
    def _collect_fact_evidence(cls, query: str, document_id: Optional[int], allowed_doc_ids: Optional[List[int]], db) -> Dict[str, Any]:
        """Search the Fact (S-P-O triple) store."""
        evidence = {"source": "Fact Store", "passages": [], "facts": [], "count": 0}

        if allowed_doc_ids is not None:
            if document_id and document_id not in allowed_doc_ids:
                return evidence
            elif not document_id and not allowed_doc_ids:
                return evidence

        try:
            stop_words = {"what", "is", "the", "a", "an", "in", "of", "for", "to", "and", "or", "are",
                          "there", "any", "do", "we", "have", "can", "you", "tell", "me", "about",
                          "how", "many", "show", "list", "find", "search", "this", "that", "with"}
            words = [w.strip("?.,!\"'()") for w in query.split()]
            keywords = [w for w in words if len(w) > 2 and w.lower() not in stop_words]

            if not keywords:
                return evidence

            matched_facts = []
            seen_ids = set()

            for kw in keywords:
                base_q = db.query(Fact).filter(
                    (Fact.subject.ilike(f"%{kw}%")) |
                    (Fact.predicate.ilike(f"%{kw}%")) |
                    (Fact.object.ilike(f"%{kw}%"))
                )
                if document_id:
                    base_q = base_q.filter(Fact.document_id == document_id)
                elif allowed_doc_ids is not None:
                    base_q = base_q.filter(Fact.document_id.in_(allowed_doc_ids))

                facts = base_q.limit(15).all()
                for f in facts:
                    if f.id not in seen_ids:
                        seen_ids.add(f.id)
                        matched_facts.append(f)

            if matched_facts:
                for f in matched_facts[:20]:
                    evidence["facts"].append(f"{f.subject} {f.predicate} {f.object} (confidence: {f.confidence:.2f})")
                    evidence["passages"].append(f"Fact Store: {f.subject} → {f.predicate} → {f.object}")
                evidence["count"] = len(matched_facts)

        except Exception as e:
            evidence["passages"].append(f"Fact search error: {str(e)}")

        return evidence

    @classmethod
    def _collect_graph_evidence(cls, query: str, document_id: Optional[int], allowed_doc_ids: Optional[List[int]]) -> Dict[str, Any]:
        """Search Neo4j knowledge graph for relationships."""
        evidence = {"source": "Neo4j Graph", "passages": [], "nodes": [], "count": 0}

        if allowed_doc_ids is not None:
            if document_id and document_id not in allowed_doc_ids:
                return evidence
            elif not document_id and not allowed_doc_ids:
                return evidence

        try:
            stop_words = {"what", "is", "the", "a", "an", "in", "of", "for", "to", "and", "or", "are",
                          "there", "any", "do", "we", "have", "can", "you", "tell", "me", "about",
                          "how", "many", "show", "list", "find", "search", "this", "that", "with",
                          "name", "named", "called"}
            words = [w.strip("?.,!\"'()") for w in query.split()]
            keywords = [w for w in words if len(w) > 3 and w.lower() not in stop_words]

            matched_rels = []
            seen = set()

            for kw in keywords:
                if document_id:
                    res = neo4j_client.execute_read(
                        "MATCH (n)-[r]->(m) WHERE toLower(n.name) CONTAINS toLower($name) AND r.doc_id = $doc_id "
                        "RETURN n.name AS source, type(r) AS rel, m.name AS target LIMIT 5",
                        {"name": kw, "doc_id": document_id}
                    )
                    res2 = neo4j_client.execute_read(
                        "MATCH (n)-[r]->(m) WHERE toLower(m.name) CONTAINS toLower($name) AND r.doc_id = $doc_id "
                        "RETURN n.name AS source, type(r) AS rel, m.name AS target LIMIT 5",
                        {"name": kw, "doc_id": document_id}
                    )
                elif allowed_doc_ids is not None:
                    res = neo4j_client.execute_read(
                        "MATCH (n)-[r]->(m) WHERE toLower(n.name) CONTAINS toLower($name) AND r.doc_id IN $allowed_doc_ids "
                        "RETURN n.name AS source, type(r) AS rel, m.name AS target LIMIT 5",
                        {"name": kw, "allowed_doc_ids": allowed_doc_ids}
                    )
                    res2 = neo4j_client.execute_read(
                        "MATCH (n)-[r]->(m) WHERE toLower(m.name) CONTAINS toLower($name) AND r.doc_id IN $allowed_doc_ids "
                        "RETURN n.name AS source, type(r) AS rel, m.name AS target LIMIT 5",
                        {"name": kw, "allowed_doc_ids": allowed_doc_ids}
                    )
                else:
                    res = neo4j_client.execute_read(
                        "MATCH (n)-[r]->(m) WHERE toLower(n.name) CONTAINS toLower($name) "
                        "RETURN n.name AS source, type(r) AS rel, m.name AS target LIMIT 5",
                        {"name": kw}
                    )
                    res2 = neo4j_client.execute_read(
                        "MATCH (n)-[r]->(m) WHERE toLower(m.name) CONTAINS toLower($name) "
                        "RETURN n.name AS source, type(r) AS rel, m.name AS target LIMIT 5",
                        {"name": kw}
                    )

                for r in (res or []) + (res2 or []):
                    key = (r.get("source", ""), r.get("rel", ""), r.get("target", ""))
                    if key not in seen:
                        seen.add(key)
                        matched_rels.append(r)

            if matched_rels:
                for r in matched_rels[:15]:
                    evidence["passages"].append(f"Neo4j: {r['source']} -[{r['rel']}]-> {r['target']}")
                evidence["nodes"] = list(set(
                    [r["source"] for r in matched_rels] + [r["target"] for r in matched_rels]
                ))
                evidence["count"] = len(matched_rels)

        except Exception as e:
            evidence["passages"].append(f"Graph search error: {str(e)}")

        return evidence

    @classmethod
    def _collect_semantic_evidence(cls, query: str, document_id: Optional[int], allowed_doc_ids: Optional[List[int]]) -> Dict[str, Any]:
        """Search Qdrant vector DB for semantically similar document chunks."""
        evidence = {"source": "Qdrant Vector DB", "passages": [], "contexts": []}

        if allowed_doc_ids is not None:
            if document_id and document_id not in allowed_doc_ids:
                return evidence
            elif not document_id and not allowed_doc_ids:
                return evidence

        try:
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
            elif allowed_doc_ids is not None:
                query_filter = qdrant_models.Filter(
                    must=[
                        qdrant_models.FieldCondition(
                            key="document_id",
                            match=qdrant_models.MatchAny(any=allowed_doc_ids)
                        )
                    ]
                )

            vector = embedding_model.encode(query).tolist()
            results = qdrant_client.search_points("documents", vector, limit=5, query_filter=query_filter)

            if results:
                for r in results:
                    text_chunk = r.payload.get("parent_text", r.payload.get("text", ""))
                    doc_id = r.payload.get("document_id", "?")
                    score = getattr(r, 'score', 0)
                    evidence["contexts"].append(text_chunk)
                    evidence["passages"].append(f"Qdrant: Doc ID {doc_id} (score: {score:.3f})")

        except Exception as e:
            evidence["passages"].append(f"Semantic search error: {str(e)}")

        return evidence

    @classmethod
    def _collect_summary_evidence(cls, query: str, document_id: Optional[int], allowed_doc_ids: Optional[List[int]], db) -> Dict[str, Any]:
        """Check if we have pre-generated summaries for the document."""
        evidence = {"source": "Summaries", "passages": [], "summary_text": None}

        if allowed_doc_ids is not None:
            if document_id and document_id not in allowed_doc_ids:
                return evidence
            elif not document_id and not allowed_doc_ids:
                return evidence

        try:
            if document_id:
                summaries = db.query(Summary).filter(Summary.document_id == document_id).all()
            elif allowed_doc_ids is not None:
                summaries = db.query(Summary).filter(Summary.document_id.in_(allowed_doc_ids)).order_by(Summary.id.desc()).limit(5).all()
            else:
                summaries = db.query(Summary).order_by(Summary.id.desc()).limit(5).all()

            if summaries:
                evidence["summary_text"] = "\n\n".join([s.summary_text for s in summaries])
                evidence["passages"].extend([f"Summary: Doc ID {s.document_id}" for s in summaries])
        except Exception:
            pass

        return evidence

    @classmethod
    def _collect_past_chats_evidence(cls, query: str, session_id: Optional[str], user_id: Optional[int], db) -> Dict[str, Any]:
        """Search the ChatMessage history (past queries/replies) for matches."""
        evidence = {"source": "Past Chat History", "passages": [], "history_contexts": []}
        try:
            stop_words = {"what", "is", "the", "a", "an", "in", "of", "for", "to", "and", "or", "are",
                          "there", "any", "do", "we", "have", "can", "you", "tell", "me", "about",
                          "how", "many", "show", "list", "find", "search", "this", "that", "with",
                          "who", "what", "which", "when", "where", "why", "how"}
            words = [w.strip("?.,!\"'()") for w in query.split()]
            keywords = [w for w in words if len(w) > 3 and w.lower() not in stop_words]

            if not keywords:
                return evidence

            # Build OR filter conditions for database
            from sqlalchemy import or_
            conditions = []
            for kw in keywords:
                conditions.append(ChatMessage.text.ilike(f"%{kw}%"))

            if not conditions:
                return evidence

            query_obj = db.query(ChatMessage).filter(or_(*conditions))
            if session_id:
                query_obj = query_obj.filter(ChatMessage.session_id != session_id)
            if user_id:
                # Isolate history context search to this user
                query_obj = query_obj.filter(ChatMessage.user_id == user_id)
            
            matches = query_obj.order_by(ChatMessage.timestamp.desc()).limit(10).all()
            
            if matches:
                # Group by session
                by_session = {}
                for m in matches:
                    if m.session_id not in by_session:
                        by_session[m.session_id] = []
                    by_session[m.session_id].append(m)
                
                for s_id, msgs in by_session.items():
                    msgs = sorted(msgs, key=lambda x: x.timestamp)
                    block = []
                    for m in msgs:
                        role = "User" if m.sender == "user" else "Assistant"
                        block.append(f"{role}: {m.text}")
                    evidence["history_contexts"].append(
                        f"--- Past Conversation (Session: {s_id}) ---\n" + "\n".join(block)
                    )
                    evidence["passages"].append(f"Past Chat Session: {s_id}")
        except Exception as e:
            evidence["passages"].append(f"Past chat search error: {str(e)}")
        return evidence

    # ------------------------------------------------------------------ #
    #  Main orchestrator: multi-source retrieval + LLM synthesis           #
    # ------------------------------------------------------------------ #
    @classmethod
    def execute_chat_query(cls, query: str, document_id: Optional[int] = None, session_id: Optional[str] = None, user_id: Optional[int] = None, role: Optional[str] = None) -> Dict[str, Any]:
        """
        Multi-source retrieval engine with workspace RBAC & Token Governance.
        Gathers evidence from visible sources, checks user quotas,
        and saves message interactions in Postgres.
        """
        # 1. Enforce Token Governance check prior to processing
        if user_id:
            if not TokenGovernance.check_quota(user_id):
                return {
                    "answer": "⚠️ Daily Token Quota Exceeded. Please contact your administrator.",
                    "confidence": "0%",
                    "sources": [],
                    "graph_nodes_used": [],
                    "fact_count": 0,
                    "graph_count": 0
                }

        # 2. Check cache first
        cache_key = cls._cache_key(query, document_id)
        cached = cls._cache_get(cache_key)
        if cached:
            cached["answer"] = "📌 " + cached["answer"]  # Mark as cached
            return cached

        # 3. Resolve RBAC document limits
        db = SessionLocal()
        try:
            allowed_doc_ids = cls._get_allowed_doc_ids(user_id, role, db)

            # Save User Message to database
            if session_id:
                user_msg = ChatMessage(
                    session_id=session_id,
                    user_id=user_id,
                    sender="user",
                    text=query
                )
                db.add(user_msg)
                db.commit()

            # 4. Collect evidence from visible sources
            sql_evidence = cls._collect_sql_evidence(query, document_id, allowed_doc_ids, db)
            fact_evidence = cls._collect_fact_evidence(query, document_id, allowed_doc_ids, db)
            graph_evidence = cls._collect_graph_evidence(query, document_id, allowed_doc_ids)
            semantic_evidence = cls._collect_semantic_evidence(query, document_id, allowed_doc_ids)
            summary_evidence = cls._collect_summary_evidence(query, document_id, allowed_doc_ids, db)
            chat_evidence = cls._collect_past_chats_evidence(query, session_id, user_id, db)

            # 5. Aggregate all evidence
            all_sources = []
            all_sources.extend(sql_evidence["passages"])
            all_sources.extend(fact_evidence["passages"])
            all_sources.extend(graph_evidence["passages"])
            all_sources.extend(semantic_evidence["passages"])
            all_sources.extend(summary_evidence["passages"])
            all_sources.extend(chat_evidence["passages"])

            graph_nodes = graph_evidence.get("nodes", [])
            fact_count = fact_evidence.get("count", 0)
            graph_count = graph_evidence.get("count", 0)

            # 6. Build combined context for LLM
            context_parts = []

            # SQL direct answer
            if sql_evidence.get("answer_fragment"):
                context_parts.append(f"[DATABASE RESULT]\n{sql_evidence['answer_fragment']}")

            # Facts
            if fact_evidence.get("facts"):
                facts_text = "\n".join(fact_evidence["facts"])
                context_parts.append(f"[FACT STORE - {len(fact_evidence['facts'])} facts]\n{facts_text}")

            # Graph relationships
            if graph_evidence.get("nodes"):
                graph_text = "\n".join([p for p in graph_evidence["passages"] if p.startswith("Neo4j:")])
                context_parts.append(f"[KNOWLEDGE GRAPH - {graph_count} relationships]\n{graph_text}")

            # Semantic chunks
            if semantic_evidence.get("contexts"):
                chunks_text = "\n---\n".join(semantic_evidence["contexts"][:3])
                context_parts.append(f"[DOCUMENT CONTENT - semantic search]\n{chunks_text}")

            # Summaries
            if summary_evidence.get("summary_text"):
                context_parts.append(f"[DOCUMENT SUMMARY]\n{summary_evidence['summary_text'][:2000]}")

            # Past conversation contexts
            if chat_evidence.get("history_contexts"):
                history_text = "\n\n".join(chat_evidence["history_contexts"])
                context_parts.append(f"[RELEVANT PAST CONVERSATIONS]\n{history_text}")

            # 7. Determine if we have enough evidence for a direct answer
            if sql_evidence.get("answer_fragment") and not semantic_evidence.get("contexts"):
                answer = sql_evidence["answer_fragment"]
                confidence = 0.95
            elif not context_parts:
                answer = "No relevant information was found across any data source (PostgreSQL, Fact Store, Neo4j, or Qdrant Vector DB). Please try rephrasing your question or ensure documents have been uploaded and processed."
                confidence = 0.0
            else:
                # 8. Send combined evidence to LLM for intelligent synthesis
                combined_context = "\n\n".join(context_parts)

                prompt = f"""You are a helpful AI assistant for an enterprise document management system called A-RAG.
You have been given evidence retrieved from multiple data sources. Use ALL the evidence below to answer the user's question accurately and completely.

RULES:
- Answer ONLY based on the evidence provided. Do not make up information.
- If the evidence contains the answer, state it clearly and concisely.
- If the evidence partially answers the question, share what you found and note what's missing.
- If no evidence is relevant, say "No relevant information found in the available data sources."
- Be specific - include names, numbers, and details from the evidence.
- Format your answer in a readable way using bullet points or short paragraphs.

EVIDENCE:
{combined_context}

USER QUESTION: {query}

ANSWER:"""

                answer = cls.query_vllm(prompt, max_tokens=1024)
                
                # Estimate token counts for governance (4 chars per token)
                prompt_tokens = len(prompt) // 4
                completion_tokens = len(answer) // 4
                if user_id:
                    TokenGovernance.increment_tokens(user_id, prompt_tokens + completion_tokens)

                source_count = sum([
                    1 if sql_evidence.get("answer_fragment") else 0,
                    1 if fact_evidence.get("facts") else 0,
                    1 if graph_evidence.get("nodes") else 0,
                    1 if semantic_evidence.get("contexts") else 0,
                    1 if summary_evidence.get("summary_text") else 0,
                    1 if chat_evidence.get("history_contexts") else 0,
                ])
                confidence = min(0.98, 0.60 + (source_count * 0.10))

            result = {
                "answer": answer,
                "confidence": f"{int(confidence * 100)}%",
                "sources": list(set([s for s in all_sources if not s.startswith("SQL search error") and not s.startswith("Fact search error")])),
                "graph_nodes_used": graph_nodes,
                "fact_count": fact_count,
                "graph_count": graph_count
            }

            # Save Bot Response to database
            if session_id:
                bot_msg = ChatMessage(
                    session_id=session_id,
                    user_id=user_id,
                    sender="bot",
                    text=answer,
                    meta=result
                )
                db.add(bot_msg)
                db.commit()

            # Cache the result
            if confidence > 0:
                cls._cache_set(cache_key, result)

            return result

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
