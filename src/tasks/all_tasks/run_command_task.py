import os
import subprocess

from src.tasks.base_task import BaseTask
from src.tasks.task_utils import truncate_text


class RunCommandTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "command" not in payload:
            raise ValueError("Missing 'command'")

    def execute(self, payload):
        command = payload["command"]
        shell = payload.get("shell", isinstance(command, str))
        timeout = int(payload.get("timeout", 60))
        cwd = payload.get("cwd")
        env = os.environ.copy()
        env.update(payload.get("env", {}))
        output_limit = int(payload.get("output_limit", 100000))

        completed = subprocess.run(
            command,
            shell=shell,
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )

        return {
            "command": command,
            "return_code": completed.returncode,
            "stdout": truncate_text(completed.stdout, output_limit),
            "stderr": truncate_text(completed.stderr, output_limit),
            "success": completed.returncode == 0,
        }
