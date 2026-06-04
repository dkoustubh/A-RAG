from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from app.config import settings

class QdrantConnector:
    def __init__(self):
        self.client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
        self.collections = ["documents", "summaries", "projects", "departments", "customers", "events"]

    def init_collections(self, vector_size: int = 384):
        for col in self.collections:
            try:
                # Check if collection exists
                self.client.get_collection(collection_name=col)
            except Exception:
                # Create collection if not exists
                self.client.create_collection(
                    collection_name=col,
                    vectors_config=qdrant_models.VectorParams(
                        size=vector_size,
                        distance=qdrant_models.Distance.COSINE
                    )
                )

    def upsert_points(self, collection_name: str, points: list):
        self.client.upsert(
            collection_name=collection_name,
            points=points
        )

    def search_points(self, collection_name: str, query_vector: list, limit: int = 5, query_filter = None):
        res = self.client.query_points(
            collection_name=collection_name,
            query=query_vector,
            limit=limit,
            query_filter=query_filter
        )
        return res.points

    def count_points(self, collection_name: str) -> int:
        try:
            return self.client.count(collection_name=collection_name).count
        except Exception:
            return 0

qdrant_client = QdrantConnector()
