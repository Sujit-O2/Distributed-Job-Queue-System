from __future__ import annotations

from functools import lru_cache
from importlib import import_module
from io import BytesIO
from pathlib import Path
import tempfile
import time
import os

os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

def optional_import(module_name: str, package_name: str | None = None):
    try:
        return import_module(module_name)
    except ImportError as error:
        install_name = package_name or module_name
        raise RuntimeError(f"{install_name} is required for this task") from error


def module_available(module_name: str) -> bool:
    try:
        import_module(module_name)
        return True
    except ImportError:
        return False


def truncate_text(value: str | None, limit: int = 5000) -> str | None:
    if value is None or len(value) <= limit:
        return value
    return f"{value[:limit]}... [truncated {len(value) - limit} chars]"


def parse_response_content(response, body_limit: int = 200000):
    content_type = (response.headers.get("content-type") or "").lower()
    parsed_json = None
    if "json" in content_type:
        try:
            parsed_json = response.json()
        except Exception:
            parsed_json = None

    body_text = truncate_text(response.text, body_limit)
    return {
        "status_code": response.status_code,
        "headers": dict(response.headers),
        "content_type": content_type,
        "body": body_text,
        "json": parsed_json,
    }


def request_with_retry(
    method: str,
    url: str,
    *,
    retries: int = 1,
    retry_delay: float = 1.0,
    retry_on_statuses=None,
    timeout: int | float = 30,
    **kwargs,
):
    requests = optional_import("requests", "requests")
    retry_statuses = set(retry_on_statuses or [408, 429, 500, 502, 503, 504])
    last_error = None

    for attempt in range(retries + 1):
        try:
            response = requests.request(method=method, url=url, timeout=timeout, **kwargs)
            if response.status_code not in retry_statuses or attempt >= retries:
                return response
        except Exception as error:
            last_error = error
            if attempt >= retries:
                raise

        time.sleep(retry_delay * (attempt + 1))

    if last_error:
        raise last_error
    raise RuntimeError("Request failed without a response")


def is_pdf_path(path: Path) -> bool:
    return path.suffix.lower() == ".pdf"


def is_image_path(path: Path) -> bool:
    return path.suffix.lower() in {
        ".png",
        ".jpg",
        ".jpeg",
        ".bmp",
        ".tif",
        ".tiff",
        ".webp",
        ".gif",
    }


def select_page_numbers(total_pages: int, page_numbers=None, max_pages: int | None = None):
    if total_pages <= 0:
        return []

    if page_numbers:
        selected = []
        for page_number in page_numbers:
            page_index = int(page_number)
            if 1 <= page_index <= total_pages:
                selected.append(page_index)
    else:
        selected = list(range(1, total_pages + 1))

    if max_pages is not None:
        selected = selected[: max(0, int(max_pages))]

    return selected


def extract_pdf_text(path: Path, page_numbers=None, max_pages: int | None = None):
    fitz = optional_import("fitz", "PyMuPDF")
    document = fitz.open(path)
    try:
        selected_pages = select_page_numbers(len(document), page_numbers, max_pages)
        pages = []
        for page_number in selected_pages:
            page = document.load_page(page_number - 1)
            pages.append({"page_number": page_number, "text": page.get_text("text") or ""})
        text = "\n".join(page["text"] for page in pages).strip()
        return {"path": str(path), "page_count": len(document), "pages": pages, "text": text}
    finally:
        document.close()


def render_pdf_pages(path: Path, dpi: int = 220, page_numbers=None, max_pages: int | None = None):
    fitz = optional_import("fitz", "PyMuPDF")
    pil_image = optional_import("PIL.Image", "Pillow")
    document = fitz.open(path)
    try:
        selected_pages = select_page_numbers(len(document), page_numbers, max_pages)
        images = []
        zoom = max(dpi, 72) / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        for page_number in selected_pages:
            page = document.load_page(page_number - 1)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            image = pil_image.open(BytesIO(pixmap.tobytes("png"))).convert("RGB")
            images.append((page_number, image))
        return images
    finally:
        document.close()


def preprocess_image(
    image,
    upscale_factor: float = 1.0,
    grayscale: bool = False,
    autocontrast: bool = False,
    threshold: int | None = None,
    max_dimension: int = 1536,
):
    pil_image = optional_import("PIL.Image", "Pillow")
    image_ops = optional_import("PIL.ImageOps", "Pillow")

    output = image.convert("RGB")
    width, height = output.width, output.height
    
    if upscale_factor and upscale_factor != 1.0:
        width = int(width * upscale_factor)
        height = int(height * upscale_factor)

    if max(width, height) > max_dimension:
        scale = max_dimension / float(max(width, height))
        width = int(width * scale)
        height = int(height * scale)

    if width != output.width or height != output.height:
        output = output.resize((max(1, width), max(1, height)), resample=pil_image.Resampling.BILINEAR)

    if grayscale:
        output = image_ops.grayscale(output)
    if autocontrast:
        output = image_ops.autocontrast(output)
    if threshold is not None:
        if not grayscale:
             output = image_ops.grayscale(output)
        output = output.point(lambda value: 255 if value >= threshold else 0)

    return output


@lru_cache(maxsize=8)
def _get_paddle_ocr(language: str, use_angle_cls: bool):
    import os
    os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
    paddleocr = optional_import("paddleocr", "paddleocr")
    return paddleocr.PaddleOCR(use_angle_cls=use_angle_cls, lang=language)


def _normalize_tesseract_language(language: str) -> str:
    aliases = {
        "en": "eng",
        "english": "eng",
    }
    return aliases.get(language.lower(), language)


def _ocr_with_paddle(image, language: str, use_angle_cls: bool):
    paddle = _get_paddle_ocr(language, use_angle_cls)

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as handle:
        temp_path = Path(handle.name)
    try:
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
        image.save(temp_path, format="JPEG", quality=95)
        raw_result = paddle.ocr(str(temp_path))
    finally:
        temp_path.unlink(missing_ok=True)

    blocks = []
    
    if raw_result and isinstance(raw_result, list) and len(raw_result) > 0:
        first_el = raw_result[0]
        # Handle PaddleX v3 format (dict-like or dict with 'rec_texts')
        try:
            val_keys = first_el.keys() if hasattr(first_el, "keys") else []
        except Exception:
            val_keys = []
            
        if "rec_texts" in val_keys or (isinstance(first_el, dict) and "rec_texts" in first_el):
            res_dict = dict(first_el) if hasattr(first_el, "keys") else first_el
            texts = res_dict.get("rec_texts", [])
            scores = res_dict.get("rec_scores", [])
            polys = res_dict.get("dt_polys", [])
            
            for i in range(len(texts)):
                bbox = polys[i] if i < len(polys) else None
                if hasattr(bbox, "tolist"):
                    bbox = bbox.tolist()
                elif isinstance(bbox, list):
                    bbox = [pt.tolist() if hasattr(pt, "tolist") else (list(pt) if isinstance(pt, (list, tuple)) else pt) for pt in bbox]
                try:
                    confidence = float(scores[i])
                except Exception:
                    confidence = None
                blocks.append({"text": str(texts[i]), "confidence": confidence, "bbox": bbox})
        else:
            # Handle PaddleOCR v2 format
            working_result = raw_result[0] if (len(raw_result) == 1 and isinstance(raw_result[0], list)) else raw_result
            for entry in working_result or []:
                if not isinstance(entry, (list, tuple)) or len(entry) < 2:
                    continue
                bbox = entry[0]
                if hasattr(bbox, "tolist"):
                    bbox = bbox.tolist()
                elif isinstance(bbox, list):
                    bbox = [pt.tolist() if hasattr(pt, "tolist") else (list(pt) if isinstance(pt, (list, tuple)) else pt) for pt in bbox]
                recognition = entry[1]
                if not isinstance(recognition, (list, tuple)) or len(recognition) < 2:
                    continue
                text = str(recognition[0])
                confidence = float(recognition[1]) if recognition[1] is not None else None
                blocks.append({"text": text, "confidence": confidence, "bbox": bbox})

    text = "\n".join(block["text"] for block in blocks).strip()
    confidences = [block["confidence"] for block in blocks if block["confidence"] is not None]
    average_confidence = sum(confidences) / len(confidences) if confidences else None
    return {"engine": "paddleocr", "text": text, "blocks": blocks, "confidence": average_confidence}


def _ocr_with_tesseract(image, language: str):
    pytesseract = optional_import("pytesseract", "pytesseract")
    output_type = getattr(pytesseract, "Output", None)
    normalized_language = _normalize_tesseract_language(language)

    text = pytesseract.image_to_string(image, lang=normalized_language)
    blocks = []
    confidence = None

    if output_type is not None:
        data = pytesseract.image_to_data(image, lang=normalized_language, output_type=output_type.DICT)
        confidences = []
        count = len(data.get("text", []))
        for index in range(count):
            block_text = (data["text"][index] or "").strip()
            if not block_text:
                continue
            raw_confidence = data["conf"][index]
            block_confidence = None
            try:
                block_confidence = float(raw_confidence)
            except (TypeError, ValueError):
                block_confidence = None

            blocks.append(
                {
                    "text": block_text,
                    "confidence": block_confidence,
                    "bbox": [
                        data["left"][index],
                        data["top"][index],
                        data["width"][index],
                        data["height"][index],
                    ],
                }
            )
            if block_confidence is not None and block_confidence >= 0:
                confidences.append(block_confidence)

        if confidences:
            confidence = sum(confidences) / len(confidences)

    return {"engine": "tesseract", "text": text.strip(), "blocks": blocks, "confidence": confidence}


def run_ocr_on_image(
    image,
    language: str = "en",
    engine: str = "auto",
    use_angle_cls: bool = True,
    preprocess: bool = True,
    upscale_factor: float = 1.0,
    threshold: int | None = None,
):
    working_image = preprocess_image(image, upscale_factor=upscale_factor, threshold=threshold) if preprocess else image
    requested_engine = (engine or "auto").lower()

    if requested_engine in {"auto", "paddleocr"} and module_available("paddleocr"):
        return _ocr_with_paddle(working_image, language, use_angle_cls)

    if requested_engine in {"auto", "tesseract"}:
        return _ocr_with_tesseract(working_image, language)

    raise RuntimeError("No supported OCR engine is available")


def ocr_path(
    path: Path,
    language: str = "en",
    engine: str = "auto",
    page_numbers=None,
    max_pages: int | None = None,
    dpi: int = 150,
    use_angle_cls: bool = True,
    preprocess: bool = True,
    upscale_factor: float = 1.0,
    threshold: int | None = None,
):
    pil_image = optional_import("PIL.Image", "Pillow")

    if is_pdf_path(path):
        pages = []
        for page_number, image in render_pdf_pages(path, dpi=dpi, page_numbers=page_numbers, max_pages=max_pages):
            result = run_ocr_on_image(
                image=image,
                language=language,
                engine=engine,
                use_angle_cls=use_angle_cls,
                preprocess=preprocess,
                upscale_factor=upscale_factor,
                threshold=threshold,
            )
            pages.append(
                {
                    "page_number": page_number,
                    "text": result["text"],
                    "blocks": result["blocks"],
                    "confidence": result["confidence"],
                    "engine": result["engine"],
                }
            )

        text = "\n".join(page["text"] for page in pages).strip()
        return {
            "path": str(path),
            "page_count": len(pages),
            "pages": pages,
            "text": text,
            "engine": pages[0]["engine"] if pages else engine,
        }

    with pil_image.open(path) as image:
        result = run_ocr_on_image(
            image=image,
            language=language,
            engine=engine,
            use_angle_cls=use_angle_cls,
            preprocess=preprocess,
            upscale_factor=upscale_factor,
            threshold=threshold,
        )

    return {
        "path": str(path),
        "page_count": 1,
        "pages": [
            {
                "page_number": 1,
                "text": result["text"],
                "blocks": result["blocks"],
                "confidence": result["confidence"],
                "engine": result["engine"],
            }
        ],
        "text": result["text"],
        "engine": result["engine"],
    }
