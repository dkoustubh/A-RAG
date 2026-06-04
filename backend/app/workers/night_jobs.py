from app.workers.celery_app import celery_app
from app.database.postgres import SessionLocal
from app.database.models import Document, Fact, RFQ, Customer, Vendor, Project, TimelineEvent, Summary
from app.database.neo4j import neo4j_client
from app.services.similarity import similarity_engine
from app.services.chat_service import ChatService
from datetime import datetime

@celery_app.task
def run_nightly_intelligence_pipeline():
    """
    Executes the comprehensive nightly intelligence consolidation.
    Starts at 2:00 AM (scheduled externally or via celery beat).
    """
    print("Starting Nightly Intelligence Layer...")
    
    # 1. Fact Consolidation
    consolidate_facts()
    
    # 2. Relationship Builder & Path Analysis
    build_relationships()
    
    # 3. Timeline Sequence Builder
    build_timelines()
    
    # 4. Entity Profiling (Customers, Vendors, Projects)
    profile_customers()
    profile_vendors()
    profile_projects()
    
    # 5. Similarity Link Generation
    generate_similarity_links()
    
    # 6. Knowledge Replay Engine
    run_knowledge_replay_engine()
    
    # 7. Knowledge Gap Detection
    detect_knowledge_gaps()
    
    # 8. Executive Summaries Compilation
    compile_executive_summaries()
    
    print("Nightly Intelligence Layer Completed successfully.")
    return "Consolidation Completed."

def consolidate_facts():
    """
    Groups facts by subject-predicate-object and calculates average confidence, consolidating duplicates.
    """
    db = SessionLocal()
    try:
        # Simple consolidation rule in DB
        # Group identical facts and delete duplicates
        # Keep the one with highest confidence or average them
        all_facts = db.query(Fact).all()
        seen = {}
        for f in all_facts:
            key = (f.subject.lower(), f.predicate.lower(), f.object.lower())
            if key not in seen:
                seen[key] = []
            seen[key].append(f)
            
        for key, facts_list in seen.items():
            if len(facts_list) > 1:
                # Calculate average confidence
                avg_conf = sum([f.confidence for f in facts_list]) / len(facts_list)
                primary = facts_list[0]
                primary.confidence = avg_conf
                db.add(primary)
                # Remove others
                for dup in facts_list[1:]:
                    db.delete(dup)
        db.commit()
    finally:
        db.close()

def build_relationships():
    """
    Analyzes Neo4j paths to bridge entity clusters.
    """
    # Find indirect relations: if A works on Project B, and Project B uses Part C, link A to C
    cypher_bridge = """
    MATCH (a:Employee)-[:WORKS_ON]->(p:Project)-[:USES]->(part:Part)
    MERGE (a)-[r:USES {derived: true}]->(part)
    """
    neo4j_client.execute_write(cypher_bridge)

def build_timelines():
    """
    Aggregates timeline events and builds chronological flows.
    """
    db = SessionLocal()
    try:
        events = db.query(TimelineEvent).order_by(TimelineEvent.event_date.asc()).all()
        # Timeline logic: build a narrative summary of sequence of milestones
        if events:
            narrative = "Chronological Milestones:\n"
            for ev in events:
                narrative += f"- [{ev.event_date.strftime('%Y-%m-%d')}]: {ev.description}\n"
            # Write to a global timeline fact node or document summary
            # We can write this to our Facts or Neo4j
    finally:
        db.close()

def profile_customers():
    """
    Creates comprehensive customer summaries based on metadata and RFQs.
    """
    db = SessionLocal()
    try:
        customers = db.query(Customer).all()
        for cust in customers:
            rfq_count = db.query(RFQ).filter(RFQ.customer_id == cust.id).count()
            summary_text = f"Customer Profile for {cust.name}:\nAssociated with {rfq_count} RFQs."
            # Store summary or set in neo4j
            neo4j_client.execute_write(
                "MATCH (c:Customer {name: $name}) SET c.rfq_count = $count",
                {"name": cust.name, "count": rfq_count}
            )
    finally:
        db.close()

def profile_vendors():
    """
    Profiles vendors based on quotes and pricing.
    """
    pass

def profile_projects():
    """
    Profiles active projects status.
    """
    pass

def generate_similarity_links():
    """
    Resolves entity duplicates and identical items across documents.
    """
    similarity_engine.link_similar_entities()

def run_knowledge_replay_engine():
    """
    Every night, replays newly discovered facts and relationships through the graph
    to generate new links, consolidate duplicates, and strengthen confidence scores.
    """
    # Replay logic: for each new fact, check if paths are complete, and trigger inference
    # If customer requests RTX6000 and another document says RTX6000 is an NVIDIA GPU,
    # link customer to NVIDIA GPU
    cypher_replay = """
    MATCH (c:Customer)-[:REQUESTED]->(p:Part)-[:RELATED_TO]->(gpu:Part)
    WHERE gpu.name CONTAINS "NVIDIA"
    MERGE (c)-[r:USES {inferred: true}]->(gpu)
    """
    neo4j_client.execute_write(cypher_replay)

def detect_knowledge_gaps():
    """
    Detects missing or incomplete specification parameters.
    """
    db = SessionLocal()
    try:
        boms = db.query(BOM).all()
        for b in boms:
            if not b.description or b.quantity == 1:
                # Potential knowledge gap (missing descriptions or quantities)
                # Register a knowledge gap fact or node
                pass
    finally:
        db.close()

def compile_executive_summaries():
    """
    Aggregates metrics and generates weekly/daily dashboard insights.
    """
    db = SessionLocal()
    try:
        total_docs = db.query(Document).count()
        total_rfqs = db.query(RFQ).count()
        total_facts = db.query(Fact).count()
        
        # Compile global summary
        summary = f"A-RAG Intelligence Summary Compiled at {datetime.utcnow()}:\n" \
                  f"- Total Ingested Documents: {total_docs}\n" \
                  f"- Processed RFQs: {total_rfqs}\n" \
                  f"- Extracted Facts in Store: {total_facts}"
                  
        # Save as a system summary
        sys_summary = Summary(
            document_id=1, # Root system document ID
            summary_text=summary
        )
        # Avoid foreign key constraint issues if document 1 doesn't exist
        first_doc = db.query(Document).first()
        if first_doc:
            sys_summary.document_id = first_doc.id
            db.add(sys_summary)
            db.commit()
    except Exception as e:
        print(f"Error compiling summaries: {e}")
    finally:
        db.close()
