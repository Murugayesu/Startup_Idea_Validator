#!/bin/bash

# Hugging Face Spaces requires a service listening on port 7860
echo "Starting dummy HTTP server for Hugging Face health checks on port 7860..."
python3 -m http.server 7860 &

# Start the actual Celery worker in the foreground
echo "Starting Celery background worker..."
celery -A app.worker.celery_app worker --loglevel=info --concurrency=2
