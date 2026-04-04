import base64
import csv
import json
from pathlib import Path

from src.tasks.base_task import BaseTask


class FileWriteTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "path" not in payload:
            raise ValueError("Missing 'path'")

    def execute(self, payload):
        file_path = Path(payload["path"])
        file_path.parent.mkdir(parents=True, exist_ok=True)

        write_mode = payload.get("write_mode", "text")
        encoding = payload.get("encoding", "utf-8")
        append = payload.get("append", False)

        if write_mode == "text":
            content = payload.get("content", "")
            mode = "a" if append else "w"
            with file_path.open(mode, encoding=encoding) as handle:
                handle.write(str(content))
        elif write_mode == "json":
            data = payload.get("data")
            if data is None:
                raise ValueError("Missing 'data' for json write_mode")
            with file_path.open("w", encoding=encoding) as handle:
                json.dump(data, handle, ensure_ascii=False, indent=2)
        elif write_mode == "csv":
            rows = payload.get("rows", [])
            if not isinstance(rows, list):
                raise ValueError("'rows' must be a list for csv write_mode")
            fieldnames = payload.get("fieldnames")
            if not fieldnames and rows:
                fieldnames = list(rows[0].keys())
            if not fieldnames:
                raise ValueError("Missing 'fieldnames' for empty CSV write")
            with file_path.open("w", encoding=encoding, newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
        elif write_mode == "binary":
            content_base64 = payload.get("content_base64")
            if not content_base64:
                raise ValueError("Missing 'content_base64' for binary write_mode")
            file_path.write_bytes(base64.b64decode(content_base64))
        else:
            raise ValueError(f"Unsupported write_mode: {write_mode}")

        return {
            "path": str(file_path),
            "write_mode": write_mode,
            "size_bytes": file_path.stat().st_size,
        }
