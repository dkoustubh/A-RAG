from app.database.postgres import SessionLocal
from app.database.models import RFQ, BOM
from app.database.neo4j import neo4j_client

class SimilarityEngine:
    @staticmethod
    def link_similar_entities():
        """
        Scans postgres entities to match similar items and links them together inside Neo4j.
        """
        db = SessionLocal()
        try:
            # 1. Compare RFQs (e.g. by status, associated projects)
            rfqs = db.query(RFQ).all()
            for r1 in rfqs:
                for r2 in rfqs:
                    if r1.id != r2.id and r1.customer_id == r2.customer_id and r1.customer_id is not None:
                        # Link in Neo4j
                        neo4j_client.execute_write(
                            """
                            MATCH (a:RFQ {name: $rfq1})
                            MATCH (b:RFQ {name: $rfq2})
                            MERGE (a)-[r:RELATED_TO {type: "same_customer"}]-(b)
                            """,
                            {"rfq1": r1.rfq_number, "rfq2": r2.rfq_number}
                        )

            # 2. Match BOM part numbers
            boms = db.query(BOM).all()
            for b1 in boms:
                for b2 in boms:
                    if b1.id != b2.id and b1.part_number == b2.part_number:
                        neo4j_client.execute_write(
                            """
                            MATCH (a:Part {name: $p1})
                            MATCH (b:Part {name: $p2})
                            MERGE (a)-[r:RELATED_TO {type: "identical_part"}]-(b)
                            """,
                            {"p1": b1.part_number, "p2": b2.part_number}
                        )
        finally:
            db.close()

similarity_engine = SimilarityEngine()
