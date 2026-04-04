import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from src.tasks.base_task import BaseTask


class BackupDatabaseTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "source_path" not in payload and "postgres_url" not in payload:
            raise ValueError("Provide either 'source_path' or 'postgres_url'")

    def execute(self, payload):
        if "source_path" in payload:
            source_path = Path(payload["source_path"])
            if not source_path.exists():
                raise FileNotFoundError(f"Source path not found: {source_path}")

            backup_path = Path(
                payload.get(
                    "backup_path",
                    f"{source_path.stem}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}{source_path.suffix}",
                )
            )
            backup_path.parent.mkdir(parents=True, exist_ok=True)

            if source_path.is_dir():
                archive_base = backup_path.with_suffix("") if backup_path.suffix else backup_path
                archive_format = payload.get("archive_format", "zip")
                archive_path = shutil.make_archive(str(archive_base), archive_format, root_dir=str(source_path))
                return {
                    "type": "directory_archive",
                    "source_path": str(source_path),
                    "backup_path": str(archive_path),
                }

            shutil.copy2(source_path, backup_path)
            return {"type": "file_copy", "source_path": str(source_path), "backup_path": str(backup_path)}

        postgres_url = payload["postgres_url"]
        output_path = Path(
            payload.get("backup_path", f"postgres_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql")
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)

        completed = subprocess.run(
            ["pg_dump", postgres_url, "-f", str(output_path)],
            capture_output=True,
            text=True,
            timeout=int(payload.get("timeout", 600)),
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(completed.stderr.strip() or "pg_dump failed")

        return {"type": "pg_dump", "backup_path": str(output_path)}
