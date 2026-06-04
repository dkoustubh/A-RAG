import os
from typing import Dict, Any

class KnowledgeRouter:
    @staticmethod
    def route_document(filename: str, file_content: bytes = b"") -> Dict[str, Any]:
        """
        Routes the document to appropriate chunking, parser, neo4j graph, and embedding strategies.
        """
        _, ext = os.path.splitext(filename.lower())
        name = filename.lower()
        
        # Determine classification
        doc_class = "document"
        if "rfq" in name or b"request for quote" in file_content.lower() or b"rfq" in file_content.lower():
            doc_class = "rfq"
        elif "bom" in name or b"bill of materials" in file_content.lower() or b"bom" in file_content.lower():
            doc_class = "bom"
        elif "invoice" in name or b"invoice" in file_content.lower():
            doc_class = "invoice"
        elif "quotation" in name or "quote" in name or b"quotation" in file_content.lower() or b"quote" in file_content.lower():
            doc_class = "quotation"
        elif ext in [".eml", ".msg"] or "email" in name:
            doc_class = "email"
        elif ext in [".ppt", ".pptx"]:
            doc_class = "presentation"
        elif ext in [".jpg", ".jpeg", ".png"]:
            doc_class = "image"
        elif ext in [".xls", ".xlsx", ".csv"]:
            doc_class = "spreadsheet"
            
        # Select Strategy
        strategy = {
            "class": doc_class,
            "format": ext.replace(".", ""),
            "chunk_strategy": "standard",
            "graph_strategy": "standard",
            "embed_strategy": "standard"
        }
        
        if doc_class == "rfq":
            strategy.update({
                "chunk_strategy": "metadata_aware",
                "graph_strategy": "rfq_nodes",
                "embed_strategy": "high_value"
            })
        elif doc_class == "bom":
            strategy.update({
                "chunk_strategy": "metadata_aware",
                "graph_strategy": "bom_nodes",
                "embed_strategy": "high_value"
            })
        elif doc_class == "email":
            strategy.update({
                "chunk_strategy": "timeline_aware",
                "graph_strategy": "email_nodes",
                "embed_strategy": "all_content"
            })
        elif doc_class == "presentation":
            strategy.update({
                "chunk_strategy": "slide_aware",
                "graph_strategy": "presentation_nodes",
                "embed_strategy": "summaries_only"
            })
            
        return strategy

knowledge_router = KnowledgeRouter()
