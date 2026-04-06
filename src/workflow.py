"""
PulseQueue – Worker Workflow Engine
-------------------------------------
Task dispatch with structured logging and proper error isolation.
"""

from __future__ import annotations
import logging
import requests
from datetime import datetime
from typing import Any

from src.modles.job_model import JobModel
from src.enums.job_enums import TaskType
from src.tasks.task_reg import TASK_REGISTRY

logger = logging.getLogger("PulseQueue.Workflow")


class WorkerWorkflow:
    def __init__(self, worker):
        self.worker = worker

    def process_task(self, job: JobModel) -> dict:
        logger.info(f"Workflow dispatching task {job.id} (type={job.task_type})")

        payload = job.payload or {}
        # Support both dict and list payloads by wrapping lists in a metadata dict if needed
        # but usually job.payload is the task-specific dict.
        
        result_pkg = {"job_id": job.id, "result": None, "error": None}

        try:
            task_type = job.task_type
            if isinstance(task_type, str):
                task_type = TaskType(task_type)

            task_class = TASK_REGISTRY.get(task_type)
            if not task_class:
                raise ValueError(f"No handler registered for task type: {task_type}")

            task_instance = task_class()
            result = task_instance.run(payload)
            result_pkg["result"] = result
        except Exception as error:
            logger.error(f"Workflow error on task {job.id}: {error}")
            result_pkg["error"] = str(error)
        
        # Fire API Callback if configured in payload (#92)
        if isinstance(payload, dict):
            self._fire_callback(job.id, payload, result_pkg["result"], result_pkg["error"])

        return result_pkg

    def _fire_callback(self, job_id: int, payload: dict, result: Any, error: str | None):
        callback_url = payload.get("callback_url")
        if not callback_url:
            return

        callback_token = payload.get("callback_token")
        headers = {"Content-Type": "application/json"}
        if callback_token:
            headers["Authorization"] = f"Bearer {callback_token}"

        callback_data = {
            "job_id": job_id,
            "status": "completed" if not error else "failed",
            "result": result,
            "error": error,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "PulseQueue-Enterprise"
        }

        try:
            logger.info(f"Firing callback for job {job_id} to {callback_url}")
            # Non-blocking-ish (within the worker thread), using a shorter timeout
            requests.post(callback_url, json=callback_data, headers=headers, timeout=15)
        except Exception as e:
            logger.error(f"Callback delivery failed for job {job_id}: {e}")

    def process_tasks(self, job: JobModel) -> dict:
        return self.process_task(job)
