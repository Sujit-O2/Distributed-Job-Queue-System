import re

from src.tasks.base_task import BaseTask
from src.tasks.task_utils import parse_response_content, request_with_retry, truncate_text


class ScrapeWebsiteTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "url" not in payload:
            raise ValueError("Missing 'url'")

    def execute(self, payload):
        url = payload["url"]
        response = request_with_retry(
            method="GET",
            url=url,
            headers=payload.get("headers"),
            timeout=payload.get("timeout", 30),
            retries=int(payload.get("retries", 1)),
            retry_delay=float(payload.get("retry_delay", 1)),
            retry_on_statuses=payload.get("retry_on_statuses"),
        )

        parsed = parse_response_content(response, body_limit=int(payload.get("body_limit", 200000)))
        html = parsed["body"] or ""
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else None
        links = re.findall(r'href=["\\\'](.*?)["\\\']', html, flags=re.IGNORECASE)

        return {
            "url": url,
            "status_code": response.status_code,
            "title": title,
            "link_count": len(links),
            "links": links[: int(payload.get("max_links", 50))],
            "content_preview": truncate_text(html, int(payload.get("preview_limit", 3000))),
            "json": parsed["json"],
            "headers": parsed["headers"],
        }
