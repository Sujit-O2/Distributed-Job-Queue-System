from collections import Counter
from pathlib import Path

from src.tasks.base_task import BaseTask


class LogAnalysisTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "path" not in payload:
            raise ValueError("Missing 'path'")

    def execute(self, payload):
        log_path = Path(payload["path"])
        if not log_path.exists():
            raise FileNotFoundError(f"Log file not found: {log_path}")

        keywords = payload.get("keywords", [])
        limit = int(payload.get("error_sample_limit", 20))
        lines = log_path.read_text(encoding=payload.get("encoding", "utf-8"), errors="ignore").splitlines()

        level_counts = Counter()
        keyword_counts = Counter()
        error_samples = []

        for line in lines:
            upper_line = line.upper()
            for level in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"):
                if level in upper_line:
                    level_counts[level] += 1

            for keyword in keywords:
                if keyword in line:
                    keyword_counts[keyword] += 1

            if "ERROR" in upper_line and len(error_samples) < limit:
                error_samples.append(line)

        return {
            "path": str(log_path),
            "line_count": len(lines),
            "level_counts": dict(level_counts),
            "keyword_counts": dict(keyword_counts),
            "error_samples": error_samples,
        }
