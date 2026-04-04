import subprocess
from pathlib import Path

from src.tasks.base_task import BaseTask


class VideoToAudioTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "input_path" not in payload:
            raise ValueError("Missing 'input_path'")

    def execute(self, payload):
        input_path = Path(payload["input_path"])
        if not input_path.exists():
            raise FileNotFoundError(f"Video not found: {input_path}")

        output_format = payload.get("output_format", "mp3").lstrip(".")
        output_path = Path(payload.get("output_path", str(input_path.with_suffix(f'.{output_format}'))))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        bitrate = payload.get("bitrate", "192k")

        completed = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(input_path),
                "-vn",
                "-acodec",
                payload.get("audio_codec", "libmp3lame"),
                "-ab",
                bitrate,
                str(output_path),
            ],
            capture_output=True,
            text=True,
            timeout=int(payload.get("timeout", 600)),
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(completed.stderr.strip() or "ffmpeg conversion failed")

        return {
            "input_path": str(input_path),
            "output_path": str(output_path),
            "bitrate": bitrate,
            "output_format": output_format,
        }
