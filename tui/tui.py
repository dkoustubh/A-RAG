from textual.app import App, ComposeResult
from textual.widgets import Header, Footer, TabbedContent, TabPane, Static, Input, Button, Label, RichLog
from textual.containers import Container, Horizontal, Vertical
try:
    from tui.client import ARAGClient
except ModuleNotFoundError:
    from client import ARAGClient
import time
import os

client = ARAGClient()

class ARAGTuiApp(App):
    TITLE = "A-RAG Platform Terminal Operations System"
    SUB_TITLE = "Fact Grounded Enterprise Operating System"
    BINDINGS = [
        ("q", "quit", "Quit Application"),
        ("l", "perform_login", "Login to Backend"),
        ("r", "refresh_stats", "Refresh Telemetry")
    ]
    CSS = """
    Screen {
        background: #11111b;
    }
    .panel {
        background: #1e1e2e;
        border: solid #89b4fa;
        padding: 1;
        margin: 1;
        height: auto;
    }
    .label-title {
        color: #89b4fa;
        text-style: bold;
    }
    .metric-value {
        color: #a6e3a1;
        text-style: bold;
    }
    .status-connected {
        color: #a6e3a1;
    }
    .status-disconnected {
        color: #f38ba8;
    }
    .chat-box {
        border: solid #cba6f7;
        margin: 1 1 0 1;
        height: 1fr;
        min-height: 10;
        background: #181825;
    }
    .chat-input-row {
        height: 3;
        margin: 1;
    }
    .chat-input-row Input {
        width: 1fr;
    }
    .chat-input-row Button {
        width: 14;
    }
    """

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with TabbedContent():
            with TabPane("System Dashboard", id="dash_pane"):
                with Horizontal():
                    with Vertical(classes="panel"):
                        yield Label("Hardware Telemetry", classes="label-title")
                        self.lbl_cpu = Label("CPU Load: Loading...")
                        self.lbl_ram = Label("RAM Allocation: Loading...")
                        self.lbl_gpu_util = Label("GPU Core Workload: Loading...")
                        self.lbl_gpu_vram = Label("GPU VRAM Allocation: Loading...")
                        self.lbl_gpu_temp = Label("GPU Temperature: Loading...")
                        yield self.lbl_cpu
                        yield self.lbl_ram
                        yield self.lbl_gpu_util
                        yield self.lbl_gpu_vram
                        yield self.lbl_gpu_temp
                    with Vertical(classes="panel"):
                        yield Label("Database Clusters Connection Diagnostic", classes="label-title")
                        self.lbl_postgres = Label("PostgreSQL Connection: Loading...")
                        self.lbl_redis = Label("Redis Message Broker: Loading...")
                        self.lbl_neo4j = Label("Neo4j Relationships Graph: Loading...")
                        self.lbl_qdrant = Label("Qdrant Vector DB: Loading...")
                        yield self.lbl_postgres
                        yield self.lbl_redis
                        yield self.lbl_neo4j
                        yield self.lbl_qdrant
                yield Button("Manual Telemetry Scan", id="btn_refresh", variant="primary")
            
            with TabPane("Ingestion Console", id="ingest_pane"):
                with Vertical(classes="panel"):
                    yield Label("Submit New Document Node", classes="label-title")
                    yield Input(placeholder="Specify absolute file path on local client machine...", id="txt_file_path")
                    yield Button("Initiate Ingestion Upload", id="btn_upload", variant="success")
                    self.lbl_upload_status = Label("")
                    yield self.lbl_upload_status
                with Vertical(classes="panel"):
                    yield Label("Recently Ingested Documents Registry", classes="label-title")
                    self.lbl_doc_registry = Label("Loading documents registry...")
                    yield self.lbl_doc_registry
                    
            with TabPane("Grounded Chat Console", id="chat_pane"):
                with Vertical():
                    self.chat_log = RichLog(classes="chat-box", wrap=True, highlight=True)
                    yield self.chat_log
                    with Horizontal(classes="chat-input-row"):
                        yield Input(placeholder="Submit question to A-RAG reasoning cluster...", id="txt_query")
                        yield Button("Submit", id="btn_query", variant="primary")
                        
            with TabPane("System Logs Stream", id="logs_pane"):
                self.log_stream = RichLog(highlight=True, wrap=True)
                yield self.log_stream
        yield Footer()

    def on_mount(self) -> None:
        self.log_msg("System Operating Console Loaded.")
        self.login_and_sync()
        self.set_interval(3.0, self.action_refresh_stats)

    def login_and_sync(self):
        self.log_msg("Authenticating administrator connection credentials...")
        if client.login():
            self.log_msg("Authentication handshake completed successfully.")
            self.action_refresh_stats()
            self.refresh_document_list()
        else:
            self.log_msg("Authentication error: Check settings / postgres container connection status.")

    def log_msg(self, text: str):
        timestamp = time.strftime("[%Y-%m-%d %H:%M:%S]")
        self.log_stream.write(f"{timestamp} {text}")

    def action_refresh_stats(self) -> None:
        telemetry = client.get_telemetry()
        health = client.get_health()
        
        if "error" not in telemetry:
            self.lbl_cpu.update(f"CPU Load: [bold]{telemetry.get('cpu_usage', 0)}%[/]")
            self.lbl_ram.update(f"RAM Allocation: [bold]{telemetry.get('ram_usage', 0)}%[/]")
            gpu = telemetry.get("gpu", {})
            self.lbl_gpu_util.update(f"GPU Core Workload: [bold]{gpu.get('utilization', 0)}%[/]")
            self.lbl_gpu_vram.update(f"GPU VRAM Allocation: [bold]{gpu.get('vram_usage', 0)}%[/]")
            self.lbl_gpu_temp.update(f"GPU Temperature: [bold]{gpu.get('temperature_c', 0)}°C[/]")
            
        if "error" not in health:
            srv = health.get("services", {})
            self.lbl_postgres.update(f"PostgreSQL Connection: [bold status-connected]{srv.get('postgres', 'failed').upper()}[/]")
            self.lbl_redis.update(f"Redis Message Broker: [bold status-connected]{srv.get('redis', 'failed').upper()}[/]")
            self.lbl_neo4j.update(f"Neo4j Relationships Graph: [bold status-connected]{srv.get('neo4j', 'failed').upper()}[/]")
            self.lbl_qdrant.update(f"Qdrant Vector DB: [bold status-connected]{srv.get('qdrant', 'failed').upper()}[/]")

    def refresh_document_list(self):
        docs = client.get_documents()
        if docs:
            reg_text = ""
            for doc in docs[:10]:
                status = "COMPLETED" if doc["search_ready"] else "PROCESSING"
                reg_text += f"- [{doc['created_at'][:19]}] ID: {doc['id']} | File: {os.path.basename(doc['location'])} | Status: {status}\n"
            self.lbl_doc_registry.update(reg_text)
        else:
            self.lbl_doc_registry.update("No documents ingested yet.")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn_refresh":
            self.action_refresh_stats()
            self.refresh_document_list()
        elif event.button.id == "btn_upload":
            file_path = self.query_one("#txt_file_path", Input).value
            if not file_path:
                self.lbl_upload_status.update("Error: Specify valid file path.")
                return
            self.lbl_upload_status.update("Uploading file to remote workstation...")
            self.log_msg(f"Initiating upload task for: {file_path}")
            
            res = client.upload(file_path)
            if "error" not in res:
                self.lbl_upload_status.update("Ingestion Completed! Chunks indexed.")
                self.log_msg(f"Document ingested: ID {res.get('document_id')}")
                self.refresh_document_list()
            else:
                self.lbl_upload_status.update(f"Upload error: {res.get('error')}")
                self.log_msg(f"Upload failed: {res.get('error')}")
        elif event.button.id == "btn_query":
            self.submit_chat_query()

    def submit_chat_query(self):
        query_input = self.query_one("#txt_query", Input)
        query = query_input.value
        if not query:
            return
            
        self.chat_log.write(f"\n[bold color-primary]User: {query}[/]")
        query_input.value = ""
        
        self.log_msg(f"Submitting query: {query}")
        res = client.query(query)
        
        if "error" not in res:
            self.chat_log.write(f"[bold color-success]A-RAG: {res['answer']}[/]")
            self.chat_log.write(f"[dim]Confidence: {res['confidence']} | Sources: {', '.join(res['sources']) or 'None'}[/]")
            if res["graph_nodes_used"]:
                self.chat_log.write(f"[dim]Referenced Graph Nodes: {', '.join(res['graph_nodes_used'])}[/]")
        else:
            self.chat_log.write(f"[bold red]System Error: {res['error']}[/]")

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id == "txt_query":
            self.submit_chat_query()

    def action_perform_login(self) -> None:
        self.login_and_sync()

if __name__ == "__main__":
    app = ARAGTuiApp()
    app.run()
