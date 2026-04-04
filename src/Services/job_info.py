from fastapi import HTTPException
from sqlalchemy.orm import Session
from src.schema.jobs import JobSchema
from src.modles.job_model import JobModel
from src.enums.job_enums import JobStatus
from datetime import datetime

class jobInfo:
    def __init__(self, db: Session):
        self.db = db

    def create_job(self, job_schema: JobSchema):
        exist = (
            self.db.query(JobModel)
            .filter(JobModel.title == job_schema.title, JobModel.user_id == job_schema.user_id)
            .first()
        )

        if exist:
            raise HTTPException(status_code=400, detail="Job already exists")

        new_job = JobModel(
            title=job_schema.title,
            description=job_schema.description,
            status=job_schema.status,
            task_type=job_schema.task_type,
            payload=job_schema.payload,
            result=job_schema.result,
            error=job_schema.error,
            user_id=job_schema.user_id
        )
        if job_schema.scheduled_at:
            new_job.scheduled_at = job_schema.scheduled_at

        self.db.add(new_job)
        self.db.commit()
        self.db.refresh(new_job)

        return new_job

    def get_job_info(self, job_id: int):
        job = self.db.query(JobModel).filter(JobModel.id == job_id).first()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        return job

    def list_jobs(self, user_id: int):
        return self.db.query(JobModel).filter(JobModel.user_id == user_id).all()

    def update_job_status(self, job_id: int, status: str):
        job = self.db.query(JobModel).filter(JobModel.id == job_id).first()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        if isinstance(status, str):
            try:
                status = JobStatus(status)
            except ValueError as error:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}") from error
        job.status = status
        self.db.commit()
        self.db.refresh(job)

        return job

    def delete_job(self, job_id: int):
        job = self.db.query(JobModel).filter(JobModel.id == job_id).first()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        self.db.delete(job)
        self.db.commit()

        return {"detail": "Job deleted successfully"}
    
    def get_task_for_worker(self):
        now = datetime.now()
        return (
            self.db.query(JobModel)
            .filter(JobModel.status == JobStatus.PENDING)
            .filter(JobModel.task_type.is_not(None))
            .filter((JobModel.scheduled_at.is_(None)) | (JobModel.scheduled_at <= now))
            .order_by(JobModel.created_at)
            .all()
        )

    def update_task_status(self, task_id, status):
        task = self.db.query(JobModel).filter_by(id=task_id).first()
        if task:
            if isinstance(status, str):
                try:
                    status = JobStatus(status)
                except ValueError as error:
                    raise HTTPException(status_code=400, detail=f"Invalid status: {status}") from error
            task.status = status
            self.db.commit()
            self.db.refresh(task)
        return task

    def update_output(self, task_id: int, result=None, error: str = None):
        task = self.db.query(JobModel).filter_by(id=task_id).first()
        if task:
            task.result = result
            task.error = error
            self.db.commit()
            self.db.refresh(task)
        return task
