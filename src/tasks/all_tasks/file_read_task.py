import base64
import csv
import json
from pathlib import Path

from src.tasks.base_task import BaseTask
from src.tasks.task_utils import extract_pdf_text, is_image_path, is_pdf_path, ocr_path, truncate_text


class FileReadTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "path" not in payload:
            raise ValueError("Missing 'path'")

    def execute(self, payload):
        file_path = Path(payload["path"])
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        read_mode = payload.get("read_mode") or self._infer_mode(file_path)
        encoding = payload.get("encoding", "utf-8")
        content_limit = int(payload.get("content_limit", 200000))

        if read_mode == "text":
            content = file_path.read_text(encoding=encoding, errors=payload.get("errors", "ignore"))
            return self._build_result(file_path, read_mode, truncate_text(content, content_limit))

        if read_mode == "json":
            content = json.loads(file_path.read_text(encoding=encoding))
            return self._build_result(file_path, read_mode, content)

        if read_mode == "csv":
            with file_path.open("r", encoding=encoding, newline="") as handle:
                content = list(csv.DictReader(handle))
            return self._build_result(file_path, read_mode, content)

        if read_mode == "binary":
            content = base64.b64encode(file_path.read_bytes()).decode("ascii")
            return self._build_result(file_path, read_mode, content)

        if read_mode == "pdf":
            pdf_result = extract_pdf_text(
                file_path,
                page_numbers=payload.get("page_numbers"),
                max_pages=payload.get("max_pages"),
            )
            if payload.get("force_ocr") or (payload.get("ocr_fallback", True) and not pdf_result["text"].strip()):
                ocr_result = ocr_path(
                    path=file_path,
                    language=payload.get("language", "en"),
                    engine=payload.get("engine", "auto"),
                    page_numbers=payload.get("page_numbers"),
                    max_pages=payload.get("max_pages"),
                    dpi=int(payload.get("dpi", 220)),
                    preprocess=payload.get("preprocess", True),
                    upscale_factor=float(payload.get("upscale_factor", 1.5)),
                    threshold=payload.get("threshold"),
                )
                return {
                    "path": str(file_path),
                    "read_mode": "pdf_ocr",
                    "page_count": ocr_result["page_count"],
                    "content": truncate_text(ocr_result["text"], content_limit),
                    "pages": ocr_result["pages"] if payload.get("include_pages", True) else None,
                    "engine": ocr_result["engine"],
                }

            return {
                "path": str(file_path),
                "read_mode": "pdf",
                "page_count": pdf_result["page_count"],
                "content": truncate_text(pdf_result["text"], content_limit),
                "pages": pdf_result["pages"] if payload.get("include_pages", True) else None,
                "engine": "pdf_text",
            }

        if read_mode == "ocr":
            ocr_result = ocr_path(
                path=file_path,
                language=payload.get("language", "en"),
                engine=payload.get("engine", "auto"),
                page_numbers=payload.get("page_numbers"),
                max_pages=payload.get("max_pages"),
                dpi=int(payload.get("dpi", 220)),
                preprocess=payload.get("preprocess", True),
                upscale_factor=float(payload.get("upscale_factor", 1.5)),
                threshold=payload.get("threshold"),
            )
            return {
                "path": str(file_path),
                "read_mode": "ocr",
                "page_count": ocr_result["page_count"],
                "content": truncate_text(ocr_result["text"], content_limit),
                "pages": ocr_result["pages"] if payload.get("include_pages", True) else None,
                "engine": ocr_result["engine"],
            }

        raise ValueError(f"Unsupported read_mode: {read_mode}")

    def _infer_mode(self, file_path: Path):
        suffix = file_path.suffix.lower()
        if suffix == ".json":
            return "json"
        if suffix == ".csv":
            return "csv"
        if is_pdf_path(file_path):
            return "pdf"
        if is_image_path(file_path):
            return "ocr"
        return "text"

    def _build_result(self, file_path: Path, read_mode: str, content):
        return {
            "path": str(file_path),
            "read_mode": read_mode,
            "content": content,
        }
