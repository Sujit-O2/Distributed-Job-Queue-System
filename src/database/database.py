"""
PulseQueue – Database Configuration (v2.1.0)
----------------------------------------------
  • Connection pooling with pool_pre_ping (#38)
  • Pool size & overflow configuration (#25)
  • Configurable via environment variables (#47)
  • Pool recycling for long-running workers
"""

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool


def _default_database_url():
    explicit_url = os.getenv("DATABASE_URL")
    if explicit_url:
        return explicit_url

    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    database = os.getenv("POSTGRES_DB", "jobqueue")
    port = os.getenv("POSTGRES_PORT", "5433")

    host = "postgres" if Path("/.dockerenv").exists() else "127.0.0.1"
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


DATABASE_URL = _default_database_url()

# Connection Pooling (#38, #25)
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,             # Verify connections before use
    poolclass=QueuePool,            # Thread-safe connection pool
    pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
    pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "3600")),  # Recycle every hour
    pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
    echo=os.getenv("DB_ECHO", "").lower() == "true",
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def give_worker_to_db():
    return SessionLocal()

Base = declarative_base()
