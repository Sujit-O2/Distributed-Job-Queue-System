FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PIP_NO_CACHE_DIR=1
ENV HOME=/home/appuser
ENV XDG_CACHE_HOME=/home/appuser/.cache
ENV PADDLE_HOME=/home/appuser/.paddle
ENV UPLOAD_ROOT=/app/uploads

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    gcc \
    g++ \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libpq-dev \
    libsm6 \
    libxext6 \
    libxrender1 \
    postgresql-client \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup --home /home/appuser appuser && \
    mkdir -p /home/appuser/.cache /home/appuser/.paddle /app/uploads

COPY req.txt .

RUN python -m pip install --upgrade pip && \
    pip install -r req.txt

COPY . .

RUN chmod +x /app/docker/app-start.sh /app/docker/worker-start.sh && \
    chown -R appuser:appgroup /app /home/appuser

USER appuser

EXPOSE 8000

CMD ["/app/docker/app-start.sh"]
