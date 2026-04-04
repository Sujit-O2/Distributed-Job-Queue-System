from concurrent.futures import ThreadPoolExecutor, as_completed

from src.tasks.base_task import BaseTask
from src.tasks.task_utils import parse_response_content, request_with_retry


class ApiFetchTask(BaseTask):
    MAX_PARALLEL_REQUESTS = 5

    def validate(self, payload):
        items, _ = self._normalize_payload(payload)
        if not items:
            raise ValueError("Payload list is empty")

        for item in items:
            if not isinstance(item, dict):
                raise ValueError("Each payload item must be an object")
            if "url" not in item or not item["url"]:
                raise ValueError("Missing 'url'")

    def execute(self, payload):
        items, options = self._normalize_payload(payload)
        results = [None] * len(items)

        for index, result in self._iter_results(items, options):
            results[index] = result

        return results

    def _normalize_payload(self, payload):
        if isinstance(payload, dict) and isinstance(payload.get("items"), list):
            items = payload["items"]
            options = {
                "max_parallel_requests": int(payload.get("max_parallel_requests", self.MAX_PARALLEL_REQUESTS)),
            }
            return items, options

        items = payload if isinstance(payload, list) else [payload]
        options = {"max_parallel_requests": self.MAX_PARALLEL_REQUESTS}
        return items, options

    def _iter_results(self, items, options):
        max_parallel_requests = max(1, int(options.get("max_parallel_requests", self.MAX_PARALLEL_REQUESTS)))
        with ThreadPoolExecutor(max_workers=max_parallel_requests) as executor:
            future_map = {
                executor.submit(self._execute_single, item): index
                for index, item in enumerate(items)
            }

            for future in as_completed(future_map):
                index = future_map[future]
                yield index, future.result()

    def _execute_single(self, item):
        method = item.get("method", "GET").upper()
        url = item["url"]
        headers = item.get("headers", {})
        data = item.get("data")
        params = item.get("params")
        timeout = item.get("timeout", 30)
        retries = int(item.get("retries", 1))
        retry_delay = float(item.get("retry_delay", 1))

        request_kwargs = {
            "headers": headers,
            "params": params,
        }
        if data is not None:
            if item.get("send_as") == "data":
                request_kwargs["data"] = data
            else:
                request_kwargs["json"] = data

        try:
            response = request_with_retry(
                method=method,
                url=url,
                retries=retries,
                retry_delay=retry_delay,
                retry_on_statuses=item.get("retry_on_statuses"),
                timeout=timeout,
                **request_kwargs,
            )
            output = {"url": url, "method": method}
            output.update(parse_response_content(response, body_limit=int(item.get("body_limit", 200000))))
            if response.status_code >= 400:
                output["error"] = output["body"] or f"HTTP {response.status_code}"
            return output
        except Exception as error:
            return {"url": url, "method": method, "error": str(error)}
