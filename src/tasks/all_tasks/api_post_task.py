from src.tasks.all_tasks.api_fetch_task import ApiFetchTask


class ApiPostTask(ApiFetchTask):
    def _normalize_payload(self, payload):
        items, options = super()._normalize_payload(payload)
        normalized_items = []

        for item in items:
            normalized_item = dict(item)
            normalized_item["method"] = normalized_item.get("method", "POST").upper()
            normalized_items.append(normalized_item)

        return normalized_items, options
