from pathlib import Path

from src.tasks.base_task import BaseTask
from src.tasks.task_utils import is_image_path, is_pdf_path, module_available, ocr_path


class OcrTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "input_path" not in payload and "image_path" not in payload:
            raise ValueError("Missing 'input_path'")

    def execute(self, payload):
        input_path = Path(payload.get("input_path") or payload.get("image_path"))
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")
        if not (is_image_path(input_path) or is_pdf_path(input_path)):
            raise ValueError("OcrTask supports image and PDF files only")

        preferred_engine = payload.get("engine", "auto")
        if preferred_engine == "auto" and module_available("paddleocr"):
            preferred_engine = "paddleocr"
        elif preferred_engine == "auto":
            preferred_engine = "tesseract"

        result = ocr_path(
            path=input_path,
            language=payload.get("language", "en"),
            engine=preferred_engine,
            page_numbers=payload.get("page_numbers"),
            max_pages=payload.get("max_pages"),
            dpi=int(payload.get("dpi", 220)),
            use_angle_cls=payload.get("use_angle_cls", True),
            preprocess=payload.get("preprocess", True),
            upscale_factor=float(payload.get("upscale_factor", 1.5)),
            threshold=payload.get("threshold"),
        )

        content_limit = int(payload.get("content_limit", 200000))
        if len(result["text"]) > content_limit:
            result["text"] = result["text"][:content_limit] + "... [truncated]"

        result["preferred_engine"] = preferred_engine
        return result
