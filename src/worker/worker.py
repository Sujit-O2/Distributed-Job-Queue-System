from __future__ import annotations

from datetime import datetime
from pathlib import Path
import sys
import time

if __package__ in {None, ""}:
    project_root = Path(__file__).resolve().parents[2]
    project_root_str = str(project_root)
    if project_root_str not in sys.path:
        sys.path.insert(0, project_root_str)

from src.database.database import give_worker_to_db
from src.Services.job_info import jobInfo
from src.enums.job_enums import JobStatus
from src.workflow import WorkerWorkflow


class Worker:
    def __init__(self, name):
        self.name = name
        self.tasks = []

    def find_tasks(self):
        db = give_worker_to_db()
        job_info = jobInfo(db)
        workflow = WorkerWorkflow(self)
        self.tasks = job_info.get_task_for_worker()

        for task in self.tasks:
            print(f"Worker {self.name} found task: {task.id}")
            if task.scheduled_at and task.scheduled_at > datetime.now():
                print(f"Task {task.id} is scheduled for future execution at {task.scheduled_at}")
                continue

            current_status = task.status.value if hasattr(task.status, "value") else str(task.status)
            if current_status != JobStatus.PENDING.value:
                continue

            job_info.update_task_status(task.id, JobStatus.IN_PROGRESS.value)
            print(f"Worker {self.name} is processing task: {task.id}")
            
            try:
                output = workflow.process_task(task)

                if output.get("error"):
                    job_info.update_output(task.id, None, output.get("error"))
                    job_info.update_task_status(task.id, JobStatus.FAILED.value)
                else:
                    job_info.update_output(task.id, output.get("result"), None)
                    job_info.update_task_status(task.id, JobStatus.COMPLETED.value)
            except Exception as e:
                print(f"CRITICAL WORKER EXCEPTION on task {task.id}: {str(e)}")
                job_info.update_output(task.id, None, str(e))
                job_info.update_task_status(task.id, JobStatus.FAILED.value)

            print(f"Worker {self.name} finished task: {task.id}")

        db.close()


if __name__ == "__main__":
    worker = Worker("Worker-1")
    while True:
        worker.find_tasks()
        time.sleep(5)
