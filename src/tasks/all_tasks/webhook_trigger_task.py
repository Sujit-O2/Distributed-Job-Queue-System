from src.tasks.base_task import BaseTask
from src.tasks.task_utils import parse_response_content, request_with_retry


class WebhookTriggerTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "url" not in payload:
            raise ValueError("Missing 'url'")

    def execute(self, payload):
        method = payload.get("method", "POST").upper()
        url = payload["url"]
        response = request_with_retry(
            method=method,
            url=url,
            headers=payload.get("headers", {}),
            params=payload.get("params"),
            json=payload.get("data"),
            timeout=payload.get("timeout", 30),
            retries=int(payload.get("retries", 1)),
            retry_delay=float(payload.get("retry_delay", 1)),
            retry_on_statuses=payload.get("retry_on_statuses"),
        )

        result = {"url": url, "method": method}
        result.update(parse_response_content(response, body_limit=int(payload.get("body_limit", 200000))))
        if response.status_code >= 400:
            result["error"] = result["body"] or f"HTTP {response.status_code}"
        return result
