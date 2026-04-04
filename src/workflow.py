from src.modles.job_model import JobModel
from src.enums.job_enums import TaskType
from src.tasks.task_reg import TASK_REGISTRY


class WorkerWorkflow:
    def __init__(self, worker):
        self.worker = worker

    def process_task(self, job: JobModel):
        print(f"Worker {self.worker.name} is processing task: {job.id}")

        try:
            task_type = job.task_type
            if isinstance(task_type, str):
                task_type = TaskType(task_type)

            task_class = TASK_REGISTRY.get(task_type)
            if not task_class:
                raise ValueError("Invalid Task Type")

            task_instance = task_class()
            result = task_instance.run(job.payload)
            return {"job_id": job.id, "result": result, "error": None}
        except Exception as error:
            return {"job_id": job.id, "result": None, "error": str(error)}

    def process_tasks(self, job: JobModel):
        return self.process_task(job)
