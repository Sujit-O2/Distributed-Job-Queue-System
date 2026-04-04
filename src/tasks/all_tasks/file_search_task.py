from pathlib import Path

from src.tasks.all_tasks.file_read_task import FileReadTask
from src.tasks.base_task import BaseTask
from src.tasks.task_utils import is_image_path, is_pdf_path


class FileSearchTask(BaseTask):
    SEARCHABLE_SUFFIXES = {
        ".txt",
        ".md",
        ".py",
        ".json",
        ".csv",
        ".log",
        ".yaml",
        ".yml",
        ".xml",
        ".html",
        ".htm",
    }

    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "root_path" not in payload:
            raise ValueError("Missing 'root_path'")

    def execute(self, payload):
        root_path = Path(payload["root_path"])
        if not root_path.exists():
            raise FileNotFoundError(f"Path not found: {root_path}")

        pattern = payload.get("pattern", "*")
        recursive = payload.get("recursive", True)
        contains = payload.get("contains")
        only_files = payload.get("only_files", True)
        limit = int(payload.get("limit", 200))
        case_sensitive = payload.get("case_sensitive", False)

        iterator = root_path.rglob(pattern) if recursive else root_path.glob(pattern)
        matches = []

        for path in iterator:
            if only_files and not path.is_file():
                continue

            if contains and not self._matches_content(path, payload, case_sensitive):
                continue

            matches.append(str(path))
            if len(matches) >= limit:
                break

        return {"root_path": str(root_path), "count": len(matches), "matches": matches}

    def _matches_content(self, path: Path, payload, case_sensitive: bool):
        if not path.is_file():
            return False

        suffix = path.suffix.lower()
        should_read_content = (
            suffix in self.SEARCHABLE_SUFFIXES
            or is_pdf_path(path)
            or is_image_path(path)
            or payload.get("search_all_file_types", False)
        )
        if not should_read_content:
            return False

        read_payload = {
            "path": str(path),
            "read_mode": "pdf" if is_pdf_path(path) else "ocr" if is_image_path(path) else None,
            "content_limit": int(payload.get("content_limit", 200000)),
            "ocr_fallback": payload.get("ocr_fallback", True),
            "force_ocr": payload.get("force_ocr", False),
            "language": payload.get("language", "en"),
            "engine": payload.get("engine", "auto"),
            "max_pages": payload.get("max_pages"),
            "page_numbers": payload.get("page_numbers"),
            "include_pages": False,
        }
        read_payload = {key: value for key, value in read_payload.items() if value is not None}
        content = FileReadTask().run(read_payload).get("content", "")
        if not isinstance(content, str):
            content = str(content)

        needle = payload["contains"]
        if not case_sensitive:
            content = content.lower()
            needle = needle.lower()
        return needle in content
