import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, JSON, Index, ForeignKey
from src.database.database import Base
from src.enums.job_enums import JobStatus, TaskType


class JobModel(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, index=True)
    status = Column(Enum(JobStatus, native_enum=False), default=JobStatus.PENDING, index=True)
    task_type = Column(Enum(TaskType, native_enum=False), nullable=False)
    payload = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    error = Column(String, nullable=True)
    user_id = Column(Integer, index=True)
    created_at = Column(DateTime, default=datetime.datetime.now, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)
    scheduled_at = Column(DateTime, nullable=True, index=True)
    priority = Column(Integer, default=0, index=True)

    # v3.0: Retry & Chaining (#3)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    chain_to = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    parent_job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)

    # v3.0: Worker attribution (#4)
    worker_name = Column(String, nullable=True)
    started_at = Column(DateTime, nullable=True)

    # Composite indexes for optimal query performance
    __table_args__ = (
        Index("ix_jobs_user_status", "user_id", "status"),
        Index("ix_jobs_user_priority", "user_id", "priority"),
        Index("ix_jobs_status_scheduled", "status", "scheduled_at"),
        Index("ix_jobs_user_created", "user_id", "created_at"),
    )

    def to_dict(self) -> dict:
        """Serialize to JSON-safe dict for API responses."""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "task_type": self.task_type.value if hasattr(self.task_type, "value") else str(self.task_type),
            "payload": self.payload,
            "result": self.result,
            "error": self.error,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "priority": self.priority or 0,
            "retry_count": self.retry_count or 0,
            "max_retries": self.max_retries or 3,
            "chain_to": self.chain_to,
            "parent_job_id": self.parent_job_id,
            "worker_name": self.worker_name,
            "started_at": self.started_at.isoformat() if self.started_at else None,
        }

