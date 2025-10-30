FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    pip install --upgrade pip && \
    pip install -r requirements.txt && \
    apt-get purge -y build-essential && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

COPY backend /app
RUN mkdir -p /app/uploads && \
    adduser --disabled-password --gecos "" appuser && \
    chown -R appuser /app

USER appuser

EXPOSE 8000

ENV PORT=8000

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
