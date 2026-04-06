"""
PulseQueue – Worker Health Router (v3.0)
------------------------------------------
Worker status and throughput monitoring.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from src.database.database import get_db
from src.modles.job_model import JobModel
from src.enums.job_enums import JobStatus
from src.security import get_current_user_id

logger = logging.getLogger("PulseQueue.Workers")
router = APIRouter(prefix="/workers", tags=["Workers"])


@router.get("/status", summary="Worker health overview")
async def get_worker_status(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Returns active workers based on currently in-progress jobs."""
    active_jobs = (
        db.query(
            JobModel.worker_name,
            func.count(JobModel.id).label("active_tasks"),
            func.min(JobModel.started_at).label("busy_since"),
        )
        .filter(
            JobModel.status == JobStatus.IN_PROGRESS,
            JobModel.worker_name.is_not(None),
        )
        .group_by(JobModel.worker_name)
        .all()
    )

    workers = []
    for worker_name, active_tasks, busy_since in active_jobs:
        # Get total completed by this worker
        completed = (
            db.query(func.count(JobModel.id))
            .filter(
                JobModel.worker_name == worker_name,
                JobModel.status == JobStatus.COMPLETED,
            )
            .scalar()
        )
        failed = (
            db.query(func.count(JobModel.id))
            .filter(
                JobModel.worker_name == worker_name,
                JobModel.status == JobStatus.FAILED,
            )
            .scalar()
        )
        workers.append({
            "name": worker_name,
            "status": "active",
            "active_tasks": active_tasks,
            "busy_since": busy_since.isoformat() if busy_since else None,
            "total_completed": completed,
            "total_failed": failed,
        })

    # Detect idle workers from recent history (last 24h)
    cutoff = datetime.utcnow() - timedelta(hours=24)
    recent_workers = (
        db.query(JobModel.worker_name)
        .filter(
            JobModel.worker_name.is_not(None),
            JobModel.updated_at >= cutoff,
        )
        .distinct()
        .all()
    )
    active_names = {w.name for w in workers}
    for (name,) in recent_workers:
        if name and name not in active_names:
            completed = (
                db.query(func.count(JobModel.id))
                .filter(JobModel.worker_name == name, JobModel.status == JobStatus.COMPLETED)
                .scalar()
            )
            workers.append({
                "name": name,
                "status": "idle",
                "active_tasks": 0,
                "busy_since": None,
                "total_completed": completed,
                "total_failed": 0,
            })

    return {"workers": workers, "total_active": len([w for w in workers if w["status"] == "active"])}


@router.get("/stats", summary="Job throughput statistics")
async def get_worker_stats(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Aggregate throughput stats for the last 24 hours."""
    cutoff = datetime.utcnow() - timedelta(hours=24)

    # Hourly throughput
    hourly = (
        db.query(
            func.date_trunc("hour", JobModel.updated_at).label("hour"),
            func.count(case((JobModel.status == JobStatus.COMPLETED, 1))).label("completed"),
            func.count(case((JobModel.status == JobStatus.FAILED, 1))).label("failed"),
        )
        .filter(JobModel.updated_at >= cutoff)
        .group_by(func.date_trunc("hour", JobModel.updated_at))
        .order_by(func.date_trunc("hour", JobModel.updated_at))
        .all()
    )

    # Avg execution time for completed jobs with started_at
    avg_exec = (
        db.query(
            func.avg(
                func.extract("epoch", JobModel.updated_at) - func.extract("epoch", JobModel.started_at)
            )
        )
        .filter(
            JobModel.status == JobStatus.COMPLETED,
            JobModel.started_at.is_not(None),
            JobModel.updated_at >= cutoff,
        )
        .scalar()
    )

    total_24h = db.query(func.count(JobModel.id)).filter(JobModel.updated_at >= cutoff).scalar()

    return {
        "period": "24h",
        "total_jobs": total_24h,
        "avg_execution_seconds": round(avg_exec, 2) if avg_exec else None,
        "hourly": [
            {
                "hour": h.isoformat() if h else None,
                "completed": c,
                "failed": f,
            }
            for h, c, f in hourly
        ],
    }
