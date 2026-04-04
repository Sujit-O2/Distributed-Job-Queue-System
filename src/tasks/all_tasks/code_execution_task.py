import os
import subprocess
import sys
import tempfile
from pathlib import Path

from src.tasks.base_task import BaseTask
from src.tasks.task_utils import truncate_text


class CodeExecutionTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "code" not in payload and "script_path" not in payload:
            raise ValueError("Missing 'code' or 'script_path'")

    def execute(self, payload):
        timeout = int(payload.get("timeout", 30))
        stdin_data = payload.get("stdin", "")
        cwd = payload.get("cwd")
        env = os.environ.copy()
        env.update(payload.get("env", {}))
        args = payload.get("args", [])
        output_limit = int(payload.get("output_limit", 100000))

        if "script_path" in payload:
            script_path = Path(payload["script_path"])
            command = [sys.executable, str(script_path), *args]
            cleanup_path = None
        else:
            with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as handle:
                handle.write(payload["code"])
                cleanup_path = Path(handle.name)
            command = [sys.executable, str(cleanup_path), *args]

        try:
            completed = subprocess.run(
                command,
                input=stdin_data,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=cwd,
                env=env,
                check=False,
            )
        finally:
            if cleanup_path is not None:
                cleanup_path.unlink(missing_ok=True)

        return {
            "command": command,
            "return_code": completed.returncode,
            "stdout": truncate_text(completed.stdout, output_limit),
            "stderr": truncate_text(completed.stderr, output_limit),
            "success": completed.returncode == 0,
        }
