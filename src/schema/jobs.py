from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from src.enums.job_enums import JobStatus, TaskType


class JobSchema(BaseModel):
    id: int | None = None
    title: str
    description: str | None = None
    status: JobStatus = JobStatus.PENDING
    user_id: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    task_type: TaskType
    payload: dict[str, Any] | list[dict[str, Any]] | None = None
    result: dict[str, Any] | list[dict[str, Any]] | None = None
    error: str | None = None
    scheduled_at: datetime | None = None

    model_config = {"from_attributes": True}
