import os
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ENV: str = "production"
    PORT: int = 8082
    HOST: str = "0.0.0.0"
    JWT_SECRET: str = "supersecretjwtsecretkeychangeinproduction123!"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    DATABASE_URL: str = "postgresql+psycopg2://admin:Ats%40123*@127.0.0.1:5432/ragstore_prod"
    NEO4J_URI: str = "bolt://127.0.0.1:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "Ats@123*"

    QDRANT_HOST: str = "127.0.0.1"
    QDRANT_PORT: int = 6333

    REDIS_URL: str = "redis://127.0.0.1:6378/0"

    MINIO_ENDPOINT: str = "127.0.0.1:9000"
    MINIO_ACCESS_KEY: str = "admin"
    MINIO_SECRET_KEY: str = "Ats@123*"
    MINIO_SECURE: bool = False
    MINIO_BUCKET_NAME: str = "arag-knowledge-objects"

    OPENAI_API_BASE: str = "http://127.0.0.1:8000/v1"
    OPENAI_API_KEY: str = "dummy-key-for-local-vllm"
    MODEL_NAME: str = "google/gemma-4-31B-it"

    NAS_MOUNT_PATH: str = "/mnt/nas/arag_archive"
    LOCAL_HOT_PATH: str = "/tmp/arag_hot_cache"

    EMBEDDING_DEVICE: str = "cpu"
    GLINER_MODEL: str = "urchade/gliner_medium-v2.1"
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
