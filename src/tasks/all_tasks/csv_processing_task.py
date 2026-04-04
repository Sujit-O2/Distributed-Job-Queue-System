import csv
from pathlib import Path

from src.tasks.base_task import BaseTask


class CsvProcessingTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        if "path" not in payload and "rows" not in payload:
            raise ValueError("Provide either 'path' or 'rows'")

    def execute(self, payload):
        rows = payload.get("rows")
        if rows is None:
            file_path = Path(payload["path"])
            if not file_path.exists():
                raise FileNotFoundError(f"CSV file not found: {file_path}")
            with file_path.open("r", encoding=payload.get("encoding", "utf-8"), newline="") as handle:
                rows = list(csv.DictReader(handle))

        operation = payload.get("operation", "summary")

        if operation == "summary":
            columns = list(rows[0].keys()) if rows else []
            return {"operation": operation, "row_count": len(rows), "columns": columns}

        if operation == "filter":
            column = payload.get("column")
            value = payload.get("value")
            if not column:
                raise ValueError("Missing 'column' for filter operation")
            filtered_rows = [row for row in rows if str(row.get(column)) == str(value)]
            return {"operation": operation, "row_count": len(filtered_rows), "rows": filtered_rows}

        if operation == "aggregate":
            return self._aggregate(rows, payload)

        if operation == "sort":
            column = payload.get("column")
            if not column:
                raise ValueError("Missing 'column' for sort operation")
            reverse = bool(payload.get("reverse", False))
            sorted_rows = sorted(rows, key=lambda row: str(row.get(column, "")), reverse=reverse)
            return {"operation": operation, "row_count": len(sorted_rows), "rows": sorted_rows}

        if operation == "select_columns":
            columns = payload.get("columns", [])
            if not columns:
                raise ValueError("Missing 'columns' for select_columns operation")
            selected_rows = [{column: row.get(column) for column in columns} for row in rows]
            return {"operation": operation, "row_count": len(selected_rows), "rows": selected_rows}

        raise ValueError(f"Unsupported operation: {operation}")

    def _aggregate(self, rows, payload):
        column = payload.get("column")
        agg = payload.get("agg", "sum")
        if not column:
            raise ValueError("Missing 'column' for aggregate operation")

        numeric_values = []
        for row in rows:
            raw_value = row.get(column)
            if raw_value in (None, ""):
                continue
            try:
                numeric_values.append(float(raw_value))
            except ValueError:
                continue

        if agg == "count":
            value = len(numeric_values)
        elif not numeric_values:
            value = 0
        elif agg == "sum":
            value = sum(numeric_values)
        elif agg == "avg":
            value = sum(numeric_values) / len(numeric_values)
        elif agg == "min":
            value = min(numeric_values)
        elif agg == "max":
            value = max(numeric_values)
        else:
            raise ValueError(f"Unsupported aggregate: {agg}")

        return {
            "operation": "aggregate",
            "column": column,
            "aggregate": agg,
            "value": value,
            "row_count": len(rows),
        }
