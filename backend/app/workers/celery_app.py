from celery import Celery
from app.config import settings

celery_app = Celery(
    "arag_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks", "app.workers.night_jobs"]
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.workers.tasks.high_priority_ingest": {"queue": "high_priority"},
        "app.workers.tasks.deep_extraction_task": {"queue": "normal_priority"},
        "app.workers.tasks.async_nas_sync_task": {"queue": "nas_sync"},
        "app.workers.night_jobs.*": {"queue": "night_jobs"}
    }
)
