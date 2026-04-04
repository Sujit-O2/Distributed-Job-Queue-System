import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, JSON
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
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)
    scheduled_at = Column(DateTime, nullable=True, index=True)
