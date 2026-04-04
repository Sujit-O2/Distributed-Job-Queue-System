import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

def _default_database_url():
    explicit_url = os.getenv("DATABASE_URL")
    if explicit_url:
        return explicit_url

    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    database = os.getenv("POSTGRES_DB", "jobqueue")
    port = os.getenv("POSTGRES_PORT", "5433")

    # Host runs should talk to the published Postgres port, while containers use
    # the internal Docker service name when no explicit DATABASE_URL is set.
    host = "postgres" if Path("/.dockerenv").exists() else "127.0.0.1"
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


DATABASE_URL = _default_database_url()

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

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
