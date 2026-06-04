from app.database.neo4j import neo4j_client
from app.database.postgres import SessionLocal
from app.database.models import Fact, Document

class GraphSyncService:
    @staticmethod
    def sync_document_relations(document_id: int):
        """
        Retrieves extracted facts for a document and pushes them to Neo4j.
        """
        db = SessionLocal()
        try:
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return
            
            # Sync Document Node
            neo4j_client.execute_write(
                "MERGE (d:Document {id: $doc_id}) SET d.location = $location, d.file_type = $file_type",
                {"doc_id": document.id, "location": document.location or "", "file_type": document.file_type or ""}
            )
            
            # Retrieve facts for document
            facts = db.query(Fact).filter(Fact.document_id == document_id).all()
            for fact in facts:
                # Deduce node labels from fact contents or subject/object
                # We can dynamically set labels or use generic Entity labels
                # The requirements state Neo4j holds relationships only, using specific node labels.
                sub_label = "Entity"
                obj_label = "Entity"
                
                # Check labels
                sub = fact.subject.lower()
                obj = fact.object.lower()
                
                # Simple heuristic based on text content
                if "corp" in sub or "inc" in sub or "ltd" in sub:
                    sub_label = "Customer"
                elif "tech" in sub or "solutions" in sub:
                    sub_label = "Vendor"
                
                if "rtx" in obj or "part" in obj or obj.isalnum():
                    obj_label = "Part"
                elif "project" in obj:
                    obj_label = "Project"
                
                # Run Cypher query to merge nodes and build relationships
                cypher = f"""
                MERGE (s:{sub_label} {{name: $subject}})
                MERGE (o:{obj_label} {{name: $object}})
                MERGE (s)-[r:{fact.predicate} {{confidence: $confidence, doc_id: $doc_id}}]->(o)
                """
                parameters = {
                    "subject": fact.subject,
                    "object": fact.object,
                    "confidence": fact.confidence,
                    "doc_id": document.id
                }
                neo4j_client.execute_write(cypher, parameters)
                
                # Link both entity nodes to the source document
                cypher_doc_link = f"""
                MATCH (d:Document {{id: $doc_id}})
                MATCH (s:{sub_label} {{name: $subject}})
                MATCH (o:{obj_label} {{name: $object}})
                MERGE (s)-[:MENTIONS {{doc_id: $doc_id}}]->(d)
                MERGE (o)-[:MENTIONS {{doc_id: $doc_id}}]->(d)
                """
                neo4j_client.execute_write(cypher_doc_link, parameters)
                
        finally:
            db.close()

    @staticmethod
    def get_related_nodes(node_name: str) -> list:
        """
        Retrieves direct 1-hop relationships for a node in the knowledge graph.
        """
        cypher = """
        MATCH (n {name: $node_name})-[r]->(m)
        RETURN n.name AS source, type(r) AS relation, m.name AS target, labels(m)[0] AS target_label, r.confidence AS confidence
        """
        return neo4j_client.execute_read(cypher, {"node_name": node_name})

graph_sync_service = GraphSyncService()
