# A-RAG: Autonomous Retrieval Augmented Graph Intelligence Platform

A-RAG is a production-ready, high-performance Autonomous Retrieval Augmented Graph Intelligence Platform. It combines vector databases, knowledge graphs, relational metadata, and LLMs in a multi-stage ingestion and reasoning architecture to deliver extremely accurate, traceable, and contextual grounded chat responses.

---

## 🗺️ System Architecture Overview

The platform uses a decoupled, worker-driven architecture built for high throughput, low latency (< 5-second initial ingestion search-readiness), and resource efficiency.

```mermaid
graph TD
    User([User / Client]) -->|1. Upload Doc| WebUI[React Vite Frontend]
    User -->|Manage / Diagnostics| TUI[Textual TUI Console]
    
    WebUI -->|HTTP POST| FastAPI[FastAPI Backend Engine]
    
    FastAPI -->|Write metadata & job status| PG[(PostgreSQL)]
    FastAPI -->|Upload original document| MinIO[(MinIO Object Store)]
    FastAPI -->|Extract text & chunk| FastEmbed[Fast Embedder]
    FastEmbed -->|Upsert points| Qdrant[(Qdrant Vector DB)]
    
    FastAPI -->|Dispatch heavy processing jobs| Redis{Redis Queue Broker}
    
    Redis -->|Process queues| Celery[Celery Worker Cluster]
    
    subgraph Celery Workers
        WorkerHigh[High Priority Worker: Ingestion]
        WorkerNormal[Normal Priority Worker: Deep Parsing & NAS Sync]
        WorkerNight[Night worker: Consolidation]
    end
    
    WorkerHigh -->|Table & structural extraction| Docling[Docling Layout Parser]
    WorkerHigh -->|Named entity recognition| GLiNER[GLiNER NER Model]
    WorkerHigh -->|Entity relations & triplets| GraphBuilder[Neo4j Graph Syncer]
    
    WorkerNormal -->|Periodic sync| NAS[NAS Archive Mount]
    
    GraphBuilder -->|Upsert nodes & edges| Neo4j[(Neo4j Graph Database)]
    Docling -->|Write tabular data| PG
    GLiNER -->|Write facts & timelines| PG
    
    WorkerNight -->|Consolidate facts & cluster entities| MemoryReplay[Nightly Consolidation Engine]
    MemoryReplay -->|Read facts & metrics| PG
    MemoryReplay -->|Merge nodes & resolve conflicts| Neo4j
```

---

## 🛠️ How It Works (Ingestion & Consolidation Pipelines)

A-RAG operates using a **Two-Tiered Processing Pipeline**:

### 1. Tier-1: Immediate Ingestion Pipeline (< 5-Second Target)
When a document is uploaded, it bypasses heavy models to hit search-readiness as fast as possible:
*   **Storage:** The document bytes are streamed directly to a MinIO S3 bucket under `originals/`.
*   **Classification Routing:** A deterministic rule-based `KnowledgeRouter` inspects the document structure and metadata, assigning routing classifications (e.g. `rfq`, `bom`, `invoice`, `email`).
*   **Fast-Parse:** Text is extracted using fast libraries (`pypdf`, `python-docx`, `python-pptx`, or raw text decoders).
*   **Chunking:** The document is split into parent-child overlapping chunk hierarchies.
*   **Vector Indexing:** Chunks are vectorized using a SentenceTransformer model and upserted into Qdrant. The document is instantly searchable.

### 2. Tier-2: Deep Parsing & Extraction Pipeline (Celery Workers)
In the background, Celery worker processes execute advanced parsing:
*   **Tabular Extraction:** Docling parses complex, nested tables into structural data, storing them in PostgreSQL.
*   **Zero-Shot NER:** GLiNER identifies business entities (Customers, Vendors, Projects, Timelines, Part Numbers).
*   **Fact Triplets:** S-P-O (Subject-Predicate-Object) facts are extracted (e.g., `Customer A` -> `REQUESTED` -> `Part X`).
*   **Graph Synchronization:** Extracted entities and facts are synchronized to Neo4j, forming a semantic web around the document.

### 3. Nightly Consolidation (Memory Replay)
Triggered at midnight via Celery Beat:
```mermaid
sequenceDiagram
    autonumber
    participant Beat as Celery Beat
    participant Worker as Night Worker
    participant DB as PostgreSQL
    participant Graph as Neo4j
    participant LLM as local vLLM (Gemma-4)

    Beat->>Worker: Trigger nightly_memory_consolidation
    activate Worker
    Worker->>DB: Fetch unconsolidated facts, timelines, and documents
    DB-->>Worker: Return recent raw entities & facts
    Worker->>LLM: Perform Graph Replay (Analyze conflicts, resolve duplicates, extract implicit facts)
    LLM-->>Worker: Return clean entity clusters & resolved triplets
    Worker->>Graph: Merge duplicate nodes (entity resolution) and write consolidated relations
    Worker->>DB: Archive raw data and update metrics
    deactivate Worker
```

---

## 📦 Components Stack

*   **FastAPI Backend:** Orchestrates routing, retrieval, chatbot tracing, and API endpoints on port `8082`.
*   **React + Vite Web UI:** Sleek, Tailwind CSS dashboard for document search, upload progress, and visualization on port `3002`.
*   **Textual TUI:** Diagnostic console showing GPU/CPU stats, database heartbeats, and grounded chatbot logs inside your terminal.
*   **PostgreSQL:** Handles document registries, processing job state, users, tables, and structured timeline events.
*   **Neo4j:** Maps document-to-entity and entity-to-entity graphs.
*   **Qdrant:** Houses high-dimensional parent-child vector chunks.
*   **Redis & Celery:** Drives message broker queues (`high_priority`, `normal_priority`, `night_jobs`).
*   **MinIO:** S3-compatible local bucket storage.
*   **Prometheus & Grafana:** Monitors system health, request latencies, and worker queue backlogs.

---

## 🚀 Installation & Deployment

### Prerequisites
*   Docker & Docker Compose (v2.x+)
*   An active Python 3.11 environment (for running TUI or local scripts)
*   Pre-configured local vLLM server (running at `127.0.0.1:8000` with the `google/gemma-4-31B-it` model)

### 1. Setup Environment
Clone the repository and verify your configuration files:
```bash
git clone https://github.com/dkoustubh/A-RAG.git
cd A-RAG
```

Create a `.env` file from the example:
```bash
cp .env.example .env
```
*(The default configs point to internal Docker Compose database ports. If running python services outside docker, they will connect via 127.0.0.1).*

### 2. Deploy Using Docker Compose
Start the database engines, backend, workers, and frontend:
```bash
chmod +x install.sh
./install.sh
```

This script will download image dependencies, compile layers (reusing cached environments), and boot the containers.

### 3. Running Health Checks
Verify the database connections, container status, and backend endpoints:
```bash
./healthcheck.sh
```

### 4. Running the Textual TUI
To view active GPU/CPU stats and chatbot logs inside your terminal:
```bash
cd tui
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 tui.py
```

### 5. Ingestion NAS Sync & Backups
*   **Ingestion Hot-Cache:** Temporary processing writes to `/tmp/arag_hot_cache`.
*   **NAS Archiving:** Persistent copies are backed up to `/mnt/nas/arag_archive`.
*   **Backup & Restore Databases:**
    *   To backup all DB states (Postgres schema, Qdrant snapshots, Neo4j dumps, MinIO buckets):
        ```bash
        ./backup.sh
        ```
    *   To restore to a specific timestamp:
        ```bash
        ./restore.sh <backup_timestamp>
        ```

---

## 📊 Telemetry and Monitoring
*   **Prometheus metrics** are exposed at `http://localhost:8082/metrics`.
*   **Grafana dashboards** are provisioned at `http://localhost:3000` to visualize resource trends and query latencies.

---

## 🔄 End-to-End System Processing & Data Flow Chart

The following detailed diagram and technical breakdown explain the architecture, tech stack integration, data lifecycle, and security enforcement mechanisms within the A-RAG platform.

### 1. Interactive System Flowchart

```mermaid
flowchart TB
    %% Nodes styling & definitions
    classDef client fill:#7289da,stroke:#7289da,color:#fff,stroke-width:2px;
    classDef server fill:#2c2f33,stroke:#7289da,color:#fff,stroke-width:2px;
    classDef cache fill:#d83c3e,stroke:#d83c3e,color:#fff,stroke-width:2px;
    classDef database fill:#43b581,stroke:#43b581,color:#fff,stroke-width:2px;
    classDef worker fill:#faa61a,stroke:#faa61a,color:#fff,stroke-width:2px;
    classDef model fill:#99aab5,stroke:#99aab5,color:#fff,stroke-width:2px;

    subgraph ClientLayer ["1. Client / Interface Layer"]
        UI["React + Vite Frontend (Port 3002) - Grounded Chat & Admin Console"]
        TUI["Textual TUI Terminal Console - Local diagnostics & logs"]
    end
    class UI,TUI client;

    subgraph AuthSecurity ["2. Gateway & Security Enforcement"]
        FastAPI["FastAPI Backend Engine (Port 8082)"]
        JWT["JWT Validator & Dependency Resolver"]
        RBAC["RBAC Policy Context (Admin / Manager / Employee)"]
        WorkspaceScope["Workspace Data Boundary (Allowed Team Collections)"]
        TokenGov["Token Governance Guard (Daily limit check: 242,000)"]
    end
    class FastAPI,JWT,RBAC,WorkspaceScope,TokenGov server;

    subgraph CacheStore ["3. Fast Access & Cache Layer"]
        Redis["Redis Cache & Queue Broker (Quota tracking & task scheduling)"]
    end
    class Redis cache;

    subgraph Databases ["4. Distributed Persistence Engines"]
        Postgres["PostgreSQL Database (Metadata, Users, Chats, Tables, Timelines)"]
        MinIO["MinIO Object Storage - S3 (Original document archives)"]
        Qdrant["Qdrant Vector Database (Parent-Child vector embedding chunks)"]
        Neo4j["Neo4j Graph Database (Subject-Predicate-Object triplets & entities)"]
    end
    class Postgres,MinIO,Qdrant,Neo4j database;

    subgraph IngestionPipeline ["5. Ingestion & Processing Tier"]
        subgraph Tier1 ["Tier-1: Instant Ingestion"]
            Router["Knowledge Router"]
            FastEmbed["FastEmbed Vectorizer"]
        end
        subgraph Tier2 ["Tier-2: Deep Parsing (Celery Async Cluster)"]
            Celery["Celery Worker Processes"]
            Docling["Docling Layout Parser"]
            GLiNER["GLiNER Zero-Shot NER"]
            GraphBuilder["Neo4j Graph Syncer"]
        end
        subgraph NightlyConsolidation ["Nightly Consolidation Engine"]
            MemoryReplay["Midnight Consolidation Engine (Entity Resolution & Node Merging)"]
        end
    end
    class Router,FastEmbed,Celery,Docling,GLiNER,GraphBuilder,MemoryReplay worker;

    subgraph LLMInference ["6. Local Reasoning & LLM Engine"]
        vLLM["local vLLM Server (Port 8000) - Model: Gemma-4-31B-it"]
    end
    class vLLM model;

    %% Data Flow Links
    UI -->|1. Submit Login / Setup Profile| FastAPI
    FastAPI -->|2. Validate Credentials & Save Setup| Postgres
    FastAPI -->|3. Issue JWT Token| UI

    UI -->|4. Authenticated Request - Upload / Query / Telemetry| FastAPI
    FastAPI --> JWT --> RBAC
    RBAC --> WorkspaceScope
    RBAC --> TokenGov

    TokenGov -->|5. Atomically query / decrement limit| Redis
    Redis -->|Sync counters| Postgres
    TokenGov -->|If limit exceeded| FastAPI -->|429 Quota Exceeded| UI

    %% Ingestion flow
    UI -->|Upload Document| FastAPI
    FastAPI --> Router
    Router -->|Save original| MinIO
    Router -->|Split & embed| FastEmbed -->|Upsert Vectors & Workspace IDs| Qdrant
    FastAPI -->|Push background parsing task| Redis
    Redis -->|Fetch heavy jobs| Celery
    Celery -->|Extract complex tables| Docling -->|Save tabular metadata| Postgres
    Celery -->|Identify named entities| GLiNER -->|Save facts & timelines| Postgres
    Celery -->|Construct SPO triplets| GraphBuilder -->|Upsert nodes/edges| Neo4j
    
    %% Nightly flow
    Postgres -->|Trigger via Celery Beat| MemoryReplay
    MemoryReplay -->|Raw facts & relations| vLLM
    vLLM -->|Clean entity clusters & resolved triplets| MemoryReplay
    MemoryReplay -->|Merge nodes & resolve conflicts| Neo4j
    MemoryReplay -->|Archive raw logs| Postgres

    %% Retrieval / Query flow
    UI -->|Grounded Chat Query + Session ID| FastAPI
    FastAPI -->|Fetch chat history context| Postgres
    FastAPI -->|Verify allowed document scope| WorkspaceScope
    
    WorkspaceScope -.->|Parallel Retrievers| Postgres & Qdrant & Neo4j
    
    Qdrant -->|A. Semantic Chunk Retrieval| FastAPI
    Neo4j -->|B. Knowledge Graph Path Context| FastAPI
    Postgres -->|C. Extracted Tables & Fact Timelines| FastAPI
    
    FastAPI -->|D. Compile Grounded context + History| FastAPI
    FastAPI -->|E. Send request to synthesize| vLLM
    vLLM -->|F. Return reasoning & grounded answer| FastAPI
    FastAPI -->|G. Save dialogue history| Postgres
    FastAPI -->|H. Deduct consumed tokens| Redis
    FastAPI -->|I. Return response with source citations| UI

    %% Telemetry flow
    FastAPI -.->|WebSocket /monitoring/ws| UI
    FastAPI -.->|Prometheus metrics /metrics| Prometheus["Prometheus Engine"]
    Prometheus -.-> Grafana["Grafana Dashboard"]
```

### 2. Core Execution Phases

#### Phase A: Security, Multi-Tenant Isolation, & Token Governance
1. **User Authentication**: Users connect via React Web UI, providing credentials to FastAPI `/auth/login`. If logging in with temporary credentials, they are forced to complete their profile (username and password change) before gaining API access.
2. **Access Control (RBAC)**: All API endpoints are guarded by JWT tokens containing user details. Users are mapped to one of three roles:
   *   **Admin**: Global read, write, and delete permissions across all workspaces and admin CRUD tools.
   *   **Manager**: Workspace-level read and write access to their own files and assigned team collections (e.g. Engineering, Sales, HR, Finance, Operations).
   *   **Employee**: Read-only or read/write access limited to their own workspace documents and specific assigned team collections.
3. **Workspace Bounds**: A backend dependency, `_get_allowed_doc_ids()`, dynamically filters retrievals so that users can only search or see documents they own or that belong to their designated teams.
4. **Token Governance Guard**: Before compiling an LLM context payload, the backend validates the user's remaining daily token quota (default: 242,000 tokens) using a Redis atomic query. If the limit is exceeded, a `429 Quota Exceeded` exception is returned immediately to avoid unnecessary GPU waste.

#### Phase B: Ingestion Pipeline
*   **Tier-1 Ingestion (< 5s Target)**: When a document is uploaded, it is routed immediately through a fast parsing tier to ensure instant searchability. The original file is stored in MinIO. Text is extracted, parsed, partitioned into parent-child chunks, converted to vector embeddings using FastEmbed, and upserted into Qdrant alongside `owner_id` and `team_id` metadata.
*   **Tier-2 Deep Ingestion (Celery Workers)**: Heavy parsing tasks are pushed to a Redis task broker and executed asynchronously by Celery workers:
    *   **Docling Layout Parser** reads structural components (e.g., nested financial or technical tables) and writes tabular representations directly to PostgreSQL.
    *   **GLiNER Zero-Shot NER** extracts business entities, timelines, and transactional facts, writing event streams to PostgreSQL.
    *   **Graph Builder** processes Subject-Predicate-Object relationships, executing Cypher queries to sync the graph with Neo4j.
*   **Nightly Consolidation (Memory Replay)**: Triggered at midnight via Celery Beat, a dedicated worker reads raw extracted facts from PostgreSQL, queries the local Gemma model to resolve redundant entities and conflicts, merges overlapping nodes in Neo4j, and archives processed logs.

#### Phase C: Grounded Chat & Retrieval Execution
When a user submits a query within a chat session:
1. **Query Expansion & History**: The backend retrieves past dialogue messages (from Postgres `ChatMessage` associated with the active session ID) to enrich the current user query.
2. **Scoped Document Retrieval**: The workspace resolution restricts retrievers to documents matching the user's workspace boundaries.
3. **Hybrid Retrieval Synthesis**: Multiple retrievers execute in parallel:
   *   **Qdrant Vector DB** retrieves semantic parent-child document chunks.
   *   **Neo4j Graph DB** fetches entity paths and triplet relations (nodes/edges).
   *   **Postgres Relational Store** extracts tabular sheets and structured events.
   *   **Postgres Fact Store** provides chronological timelines and facts.
4. **LLM Generation**: The combined contexts are compiled into a unified context prompt and sent to the local vLLM server running the `google/gemma-4-31B-it` model.
5. **Deduction & Citations**: Post-generation, the exact tokens consumed are computed, subtracted from the user's Redis quota, and synced back to Postgres. The grounded answer is returned to the UI alongside exact citations and interactive metadata accordions showing vectors, SQL tables, and graph linkages.

#### Phase D: Real-Time Telemetry & Monitoring
*   **WebSocket Stream**: Telemetry processes broadcast system stats (CPU, memory, storage utilization, active jobs, and online users count) over WebSockets at `/monitoring/ws`, updating the Admin Console charts in real time.
*   **Prometheus & Grafana**: System log metrics, database heartbeats, and API performance traces are exposed to Prometheus and visualized on a Grafana dashboard.
