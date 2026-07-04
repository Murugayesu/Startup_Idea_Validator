from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "startup_validator",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Prevent tasks from being retried silently on worker restart
    task_acks_late=True,
    worker_prefetch_multiplier=1,   # one task at a time per worker process
    # Celery Beat schedule for stuck-run cleanup (Phase 3)
    beat_schedule={
        "cleanup-stuck-runs": {
            "task": "app.worker.tasks.cleanup_stuck_runs",
            "schedule": 60.0,  # every 60 seconds
        }
    },
)

# Auto-discover tasks in the worker module
celery_app.autodiscover_tasks(["app.worker"])
