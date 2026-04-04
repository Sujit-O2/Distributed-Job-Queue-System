from src.tasks.base_task import BaseTask
from src.tasks.task_utils import parse_response_content, request_with_retry


class SendSmsTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        required_fields = ["provider_url", "to", "message"]
        missing = [field for field in required_fields if field not in payload]
        if missing:
            raise ValueError(f"Missing fields: {', '.join(missing)}")

    def execute(self, payload):
        provider_url = payload["provider_url"]
        body = {"to": payload["to"], "message": payload["message"]}
        body.update(payload.get("extra_payload", {}))

        if payload.get("dry_run", False):
            return {"dry_run": True, "provider_url": provider_url, "request_body": body}

        response = request_with_retry(
            method="POST",
            url=provider_url,
            json=body,
            headers=payload.get("headers", {}),
            timeout=payload.get("timeout", 30),
            retries=int(payload.get("retries", 1)),
            retry_delay=float(payload.get("retry_delay", 1)),
            retry_on_statuses=payload.get("retry_on_statuses"),
        )

        result = {"provider_url": provider_url, "to": payload["to"]}
        result.update(parse_response_content(response, body_limit=int(payload.get("body_limit", 200000))))
        if response.status_code >= 400:
            result["error"] = result["body"] or f"HTTP {response.status_code}"
        return result
