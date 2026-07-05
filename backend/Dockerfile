# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir litellm

# Copy application code
COPY app/ ./app/

# Default environment
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# ---------------------------------------------------------------
# CMD is intentionally omitted here.
# Railway overrides the start command per service:
#   API service:    uvicorn app.main:app --host 0.0.0.0 --port $PORT
#   Worker service: celery -A app.worker.celery_app worker --loglevel=info --concurrency=2
# ---------------------------------------------------------------
EXPOSE 8000
