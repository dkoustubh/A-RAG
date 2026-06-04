from sqlalchemy import Column, Integer, String, Text, ForeignKey, CheckConstraint, DateTime, JSON, Float, Boolean, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.postgres import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="employee", nullable=False) # admin, manager, employee
    created_at = Column(DateTime, default=datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    location = Column(String, nullable=True)
    client_name = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    industry = Column(String, nullable=True)
    file_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    search_ready = Column(Boolean, default=False)

    tables = relationship("ExtractedTable", back_populates="document", cascade="all, delete-orphan")
    metadata_entries = relationship("DocumentMetadata", back_populates="document", cascade="all, delete-orphan")
    knowledge_objects = relationship("KnowledgeObject", back_populates="document", cascade="all, delete-orphan")
    rfqs = relationship("RFQ", back_populates="document", cascade="all, delete-orphan")
    emails = relationship("Email", back_populates="document", cascade="all, delete-orphan")
    timeline_events = relationship("TimelineEvent", back_populates="document", cascade="all, delete-orphan")
    facts = relationship("Fact", back_populates="document", cascade="all, delete-orphan")
    processing_jobs = relationship("ProcessingJob", back_populates="document", cascade="all, delete-orphan")
    summaries = relationship("Summary", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("(year IS NULL) OR (year >= 1900 AND year <= 2100)", name="valid_year"),
    )

class ExtractedTable(Base):
    __tablename__ = "extracted_tables"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    table_identifier = Column(String, nullable=True)
    title = Column(String, nullable=True)
    caption = Column(String, nullable=True)
    raw_text = Column(Text, nullable=True)
    headers = Column(ARRAY(String), nullable=True)

    document = relationship("Document", back_populates="tables")
    rows = relationship("TableRow", back_populates="table", cascade="all, delete-orphan")
    metadata_entries = relationship("DocumentMetadata", back_populates="table", cascade="all, delete-orphan")

class TableRow(Base):
    __tablename__ = "table_rows"
    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("extracted_tables.id", ondelete="CASCADE"), nullable=False, index=True)
    row_values = Column(ARRAY(String), nullable=True)

    table = relationship("ExtractedTable", back_populates="rows")

class DocumentMetadata(Base):
    __tablename__ = "document_metadata"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    table_id = Column(Integer, ForeignKey("extracted_tables.id", ondelete="CASCADE"), nullable=True, index=True)
    client_name = Column(String, nullable=True)
    source_of_file = Column(String, nullable=True)
    class_ = Column("class", String, nullable=True)
    format = Column(String, nullable=True)
    chunk_text = Column(Text, nullable=True)
    year = Column(Integer, nullable=True)

    document = relationship("Document", back_populates="metadata_entries")
    table = relationship("ExtractedTable", back_populates="metadata_entries")

    __table_args__ = (
        CheckConstraint("(year IS NULL) OR (year >= 1900 AND year <= 2100)", name="valid_year"),
    )

class KnowledgeObject(Base):
    __tablename__ = "knowledge_objects"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False) # rfq, bom, email, presentation, image, invoice, quotation, etc.
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="knowledge_objects")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    code = Column(String, unique=True, index=True, nullable=True)
    contact_info = Column(Text, nullable=True)

class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    code = Column(String, unique=True, index=True, nullable=True)
    contact_info = Column(Text, nullable=True)

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    budget = Column(Float, nullable=True)
    status = Column(String, default="planning")
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)

class RFQ(Base):
    __tablename__ = "rfqs"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    rfq_number = Column(String, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, default="received")
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="rfqs")

class BOM(Base):
    __tablename__ = "bom"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    rfq_id = Column(Integer, ForeignKey("rfqs.id", ondelete="SET NULL"), nullable=True)
    part_number = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    quantity = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

class Email(Base):
    __tablename__ = "emails"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String, nullable=False, index=True)
    recipient = Column(String, nullable=False, index=True)
    subject = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)

    document = relationship("Document", back_populates="emails")

class TimelineEvent(Base):
    __tablename__ = "timeline_events"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    event_date = Column(DateTime, nullable=False, index=True)
    event_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    entities = Column(JSON, nullable=True) # associated entities

    document = relationship("Document", back_populates="timeline_events")

class Fact(Base):
    __tablename__ = "facts"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    subject = Column(String, index=True, nullable=False)
    predicate = Column(String, index=True, nullable=False)
    object = Column(String, index=True, nullable=False)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="facts")

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, default="pending") # pending, processing, completed, failed
    stage = Column(String, default="storage") # storage, extraction, knowledge, graph, search, intelligence
    error_message = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document = relationship("Document", back_populates="processing_jobs")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    action = Column(String, nullable=False)
    target = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class Summary(Base):
    __tablename__ = "summaries"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    summary_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="summaries")
