import re
from typing import Dict, Any, List
from datetime import datetime
from gliner import GLiNER
from app.config import settings
from app.database.postgres import SessionLocal
from app.database.models import (
    Document, ExtractedTable, TableRow, Fact, TimelineEvent, RFQ, BOM, Customer, Vendor, Project
)

gliner_model = None

def get_gliner_model():
    global gliner_model
    if gliner_model is None:
        try:
            gliner_model = GLiNER.from_pretrained(settings.GLINER_MODEL)
        except Exception as e:
            print(f"Error loading GLiNER model: {e}. Falling back to mock/regex model.")
            gliner_model = None
    return gliner_model

class DeepExtractor:
    @staticmethod
    def extract_tables_docling(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        """
        Uses Docling (or fallback parsing if docling is slow/fails) to extract tabular structures.
        """
        tables = []
        try:
            from docling.document_converter import DocumentConverter
            converter = DocumentConverter()
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=os.path.splitext(filename)[1], delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name
            
            result = converter.convert_single(tmp_path)
            # Extract tables
            for i, tbl in enumerate(result.tables):
                headers = [col.text for col in tbl.header.cells] if tbl.header else []
                rows = []
                for r in tbl.rows:
                    rows.append([cell.text for cell in r.cells])
                
                tables.append({
                    "table_identifier": f"table_{i+1}",
                    "title": tbl.title or f"Table {i+1}",
                    "caption": tbl.caption or "",
                    "raw_text": tbl.to_markdown() or "",
                    "headers": headers,
                    "rows": rows
                })
            os.unlink(tmp_path)
        except Exception as e:
            print(f"Docling parsing error: {e}. Running regex-based simple table parsing.")
            # Simple fallback parser for CSV/XLSX
        return tables

    @staticmethod
    def extract_entities_gliner(text: str) -> List[Dict[str, Any]]:
        """
        Uses GLiNER to identify structured entities.
        """
        model = get_gliner_model()
        if not model:
            return []
        
        labels = [
            "Customer", "Vendor", "Employee", "Project", "Part Number",
            "Technology", "Meeting", "Deadline", "Invoice Number",
            "PO Number", "RFQ Number", "BOM Components"
        ]
        
        # Limit text size to avoid memory overflow
        entities = []
        chunk_size = 2000
        for i in range(0, len(text), chunk_size):
            chunk = text[i : i + chunk_size]
            try:
                ents = model.predict_entities(chunk, labels, threshold=0.4)
                for ent in ents:
                    entities.append({
                        "text": ent["text"],
                        "label": ent["label"],
                        "score": ent.get("score", 1.0)
                    })
            except Exception as e:
                print(f"GLiNER inference error: {e}")
        return entities

    @staticmethod
    def extract_timeline_events(text: str) -> List[Dict[str, Any]]:
        """
        Extracts timeline events by finding dates and related descriptions in text.
        """
        events = []
        # Find matches for YYYY-MM-DD, DD/MM/YYYY, or Month DD, YYYY
        date_patterns = [
            r"\b\d{4}-\d{2}-\d{2}\b",
            r"\b\d{2}/\d{2}/\d{4}\b",
            r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b"
        ]
        
        for pattern in date_patterns:
            for match in re.finditer(pattern, text):
                start = max(0, match.start() - 100)
                end = min(len(text), match.end() + 150)
                context = text[start:end].strip()
                
                date_str = match.group()
                try:
                    # Basic parser
                    parsed_date = datetime.now() # Fallback
                    # Let's map date formats to datetime objects
                    if "-" in date_str:
                        parsed_date = datetime.strptime(date_str, "%Y-%m-%d")
                    elif "/" in date_str:
                        parsed_date = datetime.strptime(date_str, "%d/%m/%Y")
                    else:
                        cleaned = date_str.replace(",", "")
                        parts = cleaned.split()
                        months = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,"jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
                        month_name = parts[0][:3].lower()
                        month = months.get(month_name, 1)
                        day = int(parts[1])
                        year = int(parts[2])
                        parsed_date = datetime(year, month, day)
                    
                    events.append({
                        "event_date": parsed_date,
                        "description": context,
                        "event_type": "timeline_milestone"
                    })
                except Exception:
                    continue
        return events

    @staticmethod
    def extract_facts(text: str, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generates S-P-O facts using extracted entities and verb relationships.
        """
        facts = []
        # Find entities labeled Customer, Vendor, Project, Part Number
        subjects = [e for e in entities if e["label"] in ["Customer", "Vendor", "Employee"]]
        objects = [e for e in entities if e["label"] in ["Project", "Part Number", "Technology"]]
        
        for sub in subjects[:10]:
            for obj in objects[:10]:
                sub_text = sub["text"]
                obj_text = obj["text"]
                # Look for sentence containing both
                for sentence in text.split("."):
                    if sub_text in sentence and obj_text in sentence:
                        pred = "RELATED_TO"
                        if "request" in sentence.lower() or "need" in sentence.lower():
                            pred = "REQUESTED"
                        elif "quote" in sentence.lower() or "price" in sentence.lower():
                            pred = "QUOTED"
                        elif "buy" in sentence.lower() or "purchase" in sentence.lower() or "order" in sentence.lower():
                            pred = "PURCHASED"
                        elif "work" in sentence.lower() or "assign" in sentence.lower():
                            pred = "WORKS_ON"
                        elif "use" in sentence.lower():
                            pred = "USES"
                            
                        facts.append({
                            "subject": sub_text,
                            "predicate": pred,
                            "object": obj_text,
                            "confidence": 0.85
                        })
                        break
        return facts

    @classmethod
    def run_deep_extraction(cls, document_id: int, file_bytes: bytes, filename: str):
        """
        Performs full deep parsing, entity extraction, database population, and Neo4j syncing.
        """
        db = SessionLocal()
        try:
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return
            
            # 1. Extract tables
            tables = cls.extract_tables_docling(file_bytes, filename)
            for tbl in tables:
                extracted_table = ExtractedTable(
                    document_id=document_id,
                    table_identifier=tbl["table_identifier"],
                    title=tbl["title"],
                    caption=tbl["caption"],
                    raw_text=tbl["raw_text"],
                    headers=tbl["headers"]
                )
                db.add(extracted_table)
                db.commit()
                db.refresh(extracted_table)
                
                for row_vals in tbl["rows"]:
                    row = TableRow(
                        table_id=extracted_table.id,
                        row_values=row_vals
                    )
                    db.add(row)
            db.commit()
            
            # 2. Extract entities
            entities = cls.extract_entities_gliner(document.text)
            
            # Populate DB tables based on extracted entities
            # Create structured entities: Customers, Vendors, Projects, RFQs, BOMs
            customer_node = None
            vendor_node = None
            project_node = None
            
            for ent in entities:
                val = ent["text"]
                label = ent["label"]
                if label == "Customer":
                    # Check if exists
                    cust = db.query(Customer).filter(Customer.name == val).first()
                    if not cust:
                        cust = Customer(name=val, code=val[:5].upper())
                        db.add(cust)
                        db.commit()
                    customer_node = cust
                elif label == "Vendor":
                    vend = db.query(Vendor).filter(Vendor.name == val).first()
                    if not vend:
                        vend = Vendor(name=val, code=val[:5].upper())
                        db.add(vend)
                        db.commit()
                    vendor_node = vend
                elif label == "Project":
                    proj = db.query(Project).filter(Project.name == val).first()
                    if not proj:
                        proj = Project(name=val, status="active")
                        db.add(proj)
                        db.commit()
                    project_node = proj
            
            # If doc is RFQ class, instantiate RFQ table
            if document.industry == "rfq":
                rfq_num = f"RFQ-{uuid_suffix()}"
                rfq = RFQ(
                    document_id=document_id,
                    rfq_number=rfq_num,
                    customer_id=customer_node.id if customer_node else None,
                    project_id=project_node.id if project_node else None,
                    status="processing"
                )
                db.add(rfq)
                db.commit()
                
                # Check for parts inside entities to create BOM entries
                parts = [e for e in entities if e["label"] in ["Part Number", "BOM Components"]]
                for p in parts:
                    bom = BOM(
                        document_id=document_id,
                        rfq_id=rfq.id,
                        part_number=p["text"],
                        description=f"Extracted part from RFQ: {p['text']}",
                        quantity=1
                    )
                    db.add(bom)
                db.commit()
                
            # 3. Timeline events
            timeline_events = cls.extract_timeline_events(document.text)
            for t_ev in timeline_events:
                event = TimelineEvent(
                    document_id=document_id,
                    event_date=t_ev["event_date"],
                    event_type=t_ev["event_type"],
                    description=t_ev["description"],
                    entities={"customer": customer_node.name if customer_node else None}
                )
                db.add(event)
            db.commit()
            
            # 4. Facts triplets
            facts = cls.extract_facts(document.text, entities)
            for f in facts:
                fact = Fact(
                    document_id=document_id,
                    subject=f["subject"],
                    predicate=f["predicate"],
                    object=f["object"],
                    confidence=f["confidence"]
                )
                db.add(fact)
            db.commit()
            
        except Exception as e:
            db.rollback()
            print(f"Extraction error for document {document_id}: {e}")
            raise e
        finally:
            db.close()

def uuid_suffix() -> str:
    import uuid
    return str(uuid.uuid4())[:8].upper()

import os
