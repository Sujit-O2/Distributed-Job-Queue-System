from pathlib import Path

from src.tasks.base_task import BaseTask


class ImageCompressTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "input_path" not in payload:
            raise ValueError("Missing 'input_path'")
        if "output_path" not in payload:
            raise ValueError("Missing 'output_path'")

    def execute(self, payload):
        try:
            from PIL import Image
        except ImportError as error:
            raise RuntimeError("Pillow is required for ImageCompressTask") from error

        input_path = Path(payload["input_path"])
        output_path = Path(payload["output_path"])
        output_path.parent.mkdir(parents=True, exist_ok=True)

        quality = int(payload.get("quality", 75))
        optimize = bool(payload.get("optimize", True))
        max_width = payload.get("max_width")
        max_height = payload.get("max_height")

        with Image.open(input_path) as image:
            original_size = list(image.size)
            if max_width or max_height:
                image.thumbnail(
                    (
                        int(max_width or image.size[0]),
                        int(max_height or image.size[1]),
                    ),
                    resample=Image.Resampling.LANCZOS,
                )

            save_kwargs = {"optimize": optimize}
            image_format = payload.get("format", image.format)
            if image_format and image_format.upper() in {"JPG", "JPEG", "WEBP"}:
                save_kwargs["quality"] = quality
            image.save(output_path, format=image_format, **save_kwargs)

        with Image.open(output_path) as output_image:
            output_dimensions = list(output_image.size)

        return {
            "input_path": str(input_path),
            "output_path": str(output_path),
            "original_dimensions": original_size,
            "output_dimensions": output_dimensions,
            "original_size": input_path.stat().st_size,
            "compressed_size": output_path.stat().st_size,
        }
