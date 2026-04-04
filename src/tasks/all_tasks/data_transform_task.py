from copy import deepcopy

from src.tasks.base_task import BaseTask


class DataTransformTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "data" not in payload:
            raise ValueError("Missing 'data' in payload")

    def execute(self, payload):
        data = payload["data"]
        operations = payload.get("operations", [])

        if isinstance(data, list):
            transformed = [self._apply_operations(item, operations) for item in data]
        elif isinstance(data, dict):
            transformed = self._apply_operations(data, operations)
        else:
            raise ValueError("'data' must be a dict or list of dicts")

        return {"data": transformed}

    def _apply_operations(self, item, operations):
        if not isinstance(item, dict):
            raise ValueError("Each data item must be an object")

        result = deepcopy(item)
        for operation in operations:
            op_type = operation.get("type")

            if op_type == "rename_fields":
                mapping = operation.get("mapping", {})
                for old_key, new_key in mapping.items():
                    if old_key in result:
                        result[new_key] = result.pop(old_key)
            elif op_type == "select_fields":
                selected = set(operation.get("fields", []))
                result = {key: value for key, value in result.items() if key in selected}
            elif op_type == "remove_fields":
                for key in operation.get("fields", []):
                    result.pop(key, None)
            elif op_type == "add_fields":
                result.update(operation.get("fields", {}))
            elif op_type == "set_defaults":
                for key, value in operation.get("fields", {}).items():
                    result.setdefault(key, value)
            elif op_type == "cast_fields":
                casts = operation.get("fields", {})
                for key, cast_type in casts.items():
                    if key in result and result[key] is not None:
                        result[key] = self._cast_value(result[key], cast_type)
            else:
                raise ValueError(f"Unsupported operation type: {op_type}")

        return result

    def _cast_value(self, value, cast_type):
        cast_type = str(cast_type).lower()
        if cast_type == "str":
            return str(value)
        if cast_type == "int":
            return int(value)
        if cast_type == "float":
            return float(value)
        if cast_type == "bool":
            if isinstance(value, bool):
                return value
            return str(value).strip().lower() in {"1", "true", "yes", "y"}
        raise ValueError(f"Unsupported cast type: {cast_type}")
