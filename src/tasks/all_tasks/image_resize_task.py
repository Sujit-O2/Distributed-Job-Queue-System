from pathlib import Path

from src.tasks.base_task import BaseTask


class ImageResizeTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "input_path" not in payload:
            raise ValueError("Missing 'input_path'")
        if "output_path" not in payload:
            raise ValueError("Missing 'output_path'")
        if not any(key in payload for key in ("width", "height", "max_width", "max_height")):
            raise ValueError("Missing target dimensions")

    def execute(self, payload):
        try:
            from PIL import Image
        except ImportError as error:
            raise RuntimeError("Pillow is required for ImageResizeTask") from error

        input_path = Path(payload["input_path"])
        output_path = Path(payload["output_path"])
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with Image.open(input_path) as image:
            original_width, original_height = image.size
            width = payload.get("width")
            height = payload.get("height")

            if payload.get("keep_aspect_ratio", True):
                if width and not height:
                    ratio = int(width) / original_width
                    height = max(1, int(original_height * ratio))
                elif height and not width:
                    ratio = int(height) / original_height
                    width = max(1, int(original_width * ratio))
                elif payload.get("max_width") or payload.get("max_height"):
                    max_width = int(payload.get("max_width", original_width))
                    max_height = int(payload.get("max_height", original_height))
                    image.thumbnail((max_width, max_height), resample=Image.Resampling.LANCZOS)
                    image.save(output_path, optimize=True)
                    return {
                        "input_path": str(input_path),
                        "output_path": str(output_path),
                        "original_size": [original_width, original_height],
                        "size": list(image.size),
                    }

            resized = image.resize((int(width), int(height)), resample=Image.Resampling.LANCZOS)
            resized.save(output_path, optimize=True)

        return {
            "input_path": str(input_path),
            "output_path": str(output_path),
            "original_size": [original_width, original_height],
            "size": [int(width), int(height)],
        }
