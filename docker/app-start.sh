#!/bin/sh
set -eu

exec gunicorn "${APP_MODULE:-src.main:app}" \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${APP_PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --graceful-timeout "${GUNICORN_GRACEFUL_TIMEOUT:-30}" \
  --keep-alive "${GUNICORN_KEEPALIVE:-5}" \
  --access-logfile - \
  --error-logfile -
