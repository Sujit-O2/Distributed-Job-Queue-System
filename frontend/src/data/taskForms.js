function jsonText(value) {
  return JSON.stringify(value, null, 2);
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === undefined || item === null) {
        return false;
      }
      if (typeof item === "string") {
        return item.trim() !== "";
      }
      if (Array.isArray(item)) {
        return item.length > 0;
      }
      if (typeof item === "object") {
        return Object.keys(item).length > 0;
      }
      return true;
    }),
  );
}

function parseJsonField(value, label, fallback = undefined) {
  const text = String(value ?? "").trim();
  if (!text) {
    return fallback;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function parseIntegerField(value, label, fallback = undefined) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid whole number.`);
  }
  return parsed;
}

function parseFloatField(value, label, fallback = undefined) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number.parseFloat(String(value));
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return parsed;
}

function parseCommaList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLineList(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildSingleRequestPayload(values, defaultMethod = "GET") {
  return compactObject({
    url: values.url,
    method: values.method || defaultMethod,
    headers: parseJsonField(values.headers, "Headers", {}),
    params: parseJsonField(values.params, "Query params", {}),
    data: parseJsonField(values.data, "Request body", undefined),
    timeout: parseIntegerField(values.timeout, "Timeout", 30),
    retries: parseIntegerField(values.retries, "Retries", 1),
    retry_delay: parseFloatField(values.retry_delay, "Retry delay", 1),
    send_as: values.send_as === "data" ? "data" : undefined,
    body_limit: parseIntegerField(values.body_limit, "Body limit", 200000),
  });
}

function buildBatchRequestPayload(values, defaultMethod = "GET") {
  const items = parseJsonField(values.items, "Batch requests", []);
  if (!Array.isArray(items)) {
    throw new Error("Batch requests must be a JSON array.");
  }

  return compactObject({
    items: items.map((item) => ({
      ...item,
      method: item?.method || defaultMethod,
    })),
    max_parallel_requests: parseIntegerField(values.max_parallel_requests, "Parallel requests", 5),
  });
}

export const taskForms = {
  api_fetch: {
    note:
      "Use single mode for one endpoint or batch mode to fan out multiple requests. Files are not uploaded here; give backend-reachable paths only on file tasks.",
    defaults: {
      request_mode: "single",
      url: "https://jsonplaceholder.typicode.com/posts/1",
      method: "GET",
      headers: "{}",
      params: "{}",
      data: "",
      send_as: "json",
      timeout: "20",
      retries: "1",
      retry_delay: "1",
      body_limit: "200000",
      max_parallel_requests: "5",
      items: jsonText([
        { url: "https://jsonplaceholder.typicode.com/posts/1", method: "GET", timeout: 20 },
        { url: "https://jsonplaceholder.typicode.com/posts/2", method: "GET", timeout: 20 },
      ]),
    },
    fields: [
      {
        name: "request_mode",
        label: "Request mode",
        type: "select",
        section: "Request setup",
        required: true,
        options: [
          { value: "single", label: "Single request" },
          { value: "batch", label: "Batch requests" },
        ],
        help: "Batch mode produces the { items: [...] } backend payload.",
      },
      {
        name: "max_parallel_requests",
        label: "Parallel requests",
        type: "number",
        section: "Request setup",
        help: "Used for batch mode.",
      },
      {
        name: "url",
        label: "URL",
        type: "text",
        section: "Request setup",
        required: true,
        when: (values) => values.request_mode === "single",
        placeholder: "https://api.example.com/resource",
      },
      {
        name: "method",
        label: "Method",
        type: "select",
        section: "Request setup",
        when: (values) => values.request_mode === "single",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((value) => ({ value, label: value })),
      },
      {
        name: "headers",
        label: "Headers JSON",
        type: "json",
        section: "Request details",
        span: 2,
      },
      {
        name: "params",
        label: "Query params JSON",
        type: "json",
        section: "Request details",
        span: 2,
      },
      {
        name: "data",
        label: "Request body JSON",
        type: "json",
        section: "Request details",
        span: 2,
        when: (values) => values.request_mode === "single",
      },
      {
        name: "items",
        label: "Batch requests JSON",
        type: "json",
        section: "Request details",
        span: 2,
        when: (values) => values.request_mode === "batch",
      },
      {
        name: "send_as",
        label: "Send body as",
        type: "select",
        section: "Runtime",
        when: (values) => values.request_mode === "single",
        options: [
          { value: "json", label: "JSON" },
          { value: "data", label: "Form or raw data" },
        ],
      },
      { name: "timeout", label: "Timeout (seconds)", type: "number", section: "Runtime" },
      { name: "retries", label: "Retries", type: "number", section: "Runtime" },
      { name: "retry_delay", label: "Retry delay (seconds)", type: "number", section: "Runtime", step: "0.1" },
      { name: "body_limit", label: "Body limit", type: "number", section: "Runtime" },
    ],
    buildPayload(values) {
      return values.request_mode === "batch"
        ? buildBatchRequestPayload(values, "GET")
        : buildSingleRequestPayload(values, "GET");
    },
  },
  api_post: {
    note: "This keeps the same power as API Fetch, but defaults to POST-oriented delivery payloads.",
    defaults: {
      request_mode: "single",
      url: "https://example.com/webhooks/jobs",
      method: "POST",
      headers: "{\n  \"Content-Type\": \"application/json\"\n}",
      params: "{}",
      data: jsonText({ status: "queued" }),
      send_as: "json",
      timeout: "20",
      retries: "1",
      retry_delay: "1",
      body_limit: "200000",
      max_parallel_requests: "5",
      items: jsonText([
        { url: "https://example.com/webhooks/jobs", method: "POST", data: { status: "queued" } },
      ]),
    },
    fields: [
      {
        name: "request_mode",
        label: "Request mode",
        type: "select",
        section: "Request setup",
        required: true,
        options: [
          { value: "single", label: "Single request" },
          { value: "batch", label: "Batch requests" },
        ],
      },
      { name: "max_parallel_requests", label: "Parallel requests", type: "number", section: "Request setup" },
      {
        name: "url",
        label: "Target URL",
        type: "text",
        section: "Request setup",
        required: true,
        when: (values) => values.request_mode === "single",
      },
      {
        name: "method",
        label: "Method",
        type: "select",
        section: "Request setup",
        when: (values) => values.request_mode === "single",
        options: ["POST", "PUT", "PATCH"].map((value) => ({ value, label: value })),
      },
      { name: "headers", label: "Headers JSON", type: "json", section: "Request details", span: 2 },
      { name: "params", label: "Query params JSON", type: "json", section: "Request details", span: 2 },
      {
        name: "data",
        label: "Body JSON",
        type: "json",
        section: "Request details",
        span: 2,
        when: (values) => values.request_mode === "single",
      },
      {
        name: "items",
        label: "Batch request JSON",
        type: "json",
        section: "Request details",
        span: 2,
        when: (values) => values.request_mode === "batch",
      },
      {
        name: "send_as",
        label: "Send body as",
        type: "select",
        section: "Runtime",
        when: (values) => values.request_mode === "single",
        options: [
          { value: "json", label: "JSON" },
          { value: "data", label: "Form or raw data" },
        ],
      },
      { name: "timeout", label: "Timeout (seconds)", type: "number", section: "Runtime" },
      { name: "retries", label: "Retries", type: "number", section: "Runtime" },
      { name: "retry_delay", label: "Retry delay (seconds)", type: "number", section: "Runtime", step: "0.1" },
      { name: "body_limit", label: "Body limit", type: "number", section: "Runtime" },
    ],
    buildPayload(values) {
      return values.request_mode === "batch"
        ? buildBatchRequestPayload(values, "POST")
        : buildSingleRequestPayload(values, "POST");
    },
  },
  data_transform: {
    note: "Paste your input data and transformation pipeline. The backend runs the operations in order.",
    defaults: {
      data_input: jsonText({ name: "alpha", score: "98" }),
      operations_input: jsonText([
        { type: "rename_fields", mapping: { name: "title" } },
        { type: "cast_fields", fields: { score: "int" } },
      ]),
    },
    fields: [
      { name: "data_input", label: "Input data JSON", type: "json", section: "Data", span: 2, required: true },
      {
        name: "operations_input",
        label: "Operations JSON",
        type: "json",
        section: "Transformations",
        span: 2,
        required: true,
        help: "Use backend operations like rename_fields, cast_fields, set_fields, keep_fields, and drop_fields.",
      },
    ],
    buildPayload(values) {
      return {
        data: parseJsonField(values.data_input, "Input data"),
        operations: parseJsonField(values.operations_input, "Operations", []),
      };
    },
  },
  webhook_trigger: {
    note: "Great for downstream automations. Keep the URL and payload simple, then add headers only if needed.",
    defaults: {
      url: "https://example.com/hook",
      method: "POST",
      headers: "{}",
      params: "{}",
      data: jsonText({ event: "job.completed" }),
      timeout: "30",
      retries: "1",
      retry_delay: "1",
      body_limit: "200000",
    },
    fields: [
      { name: "url", label: "Webhook URL", type: "text", section: "Target", required: true },
      {
        name: "method",
        label: "Method",
        type: "select",
        section: "Target",
        options: ["POST", "PUT", "PATCH", "GET"].map((value) => ({ value, label: value })),
      },
      { name: "headers", label: "Headers JSON", type: "json", section: "Request details", span: 2 },
      { name: "params", label: "Query params JSON", type: "json", section: "Request details", span: 2 },
      { name: "data", label: "Payload JSON", type: "json", section: "Request details", span: 2 },
      { name: "timeout", label: "Timeout (seconds)", type: "number", section: "Runtime" },
      { name: "retries", label: "Retries", type: "number", section: "Runtime" },
      { name: "retry_delay", label: "Retry delay (seconds)", type: "number", section: "Runtime", step: "0.1" },
      { name: "body_limit", label: "Body limit", type: "number", section: "Runtime" },
    ],
    buildPayload(values) {
      return compactObject({
        url: values.url,
        method: values.method || "POST",
        headers: parseJsonField(values.headers, "Headers", {}),
        params: parseJsonField(values.params, "Query params", {}),
        data: parseJsonField(values.data, "Payload", undefined),
        timeout: parseIntegerField(values.timeout, "Timeout", 30),
        retries: parseIntegerField(values.retries, "Retries", 1),
        retry_delay: parseFloatField(values.retry_delay, "Retry delay", 1),
        body_limit: parseIntegerField(values.body_limit, "Body limit", 200000),
      });
    },
  },
  file_search: {
    note:
      "File path fields point to files available on the backend or worker machine. In Docker, use mounted folders or files already inside the container.",
    defaults: {
      root_path: ".",
      pattern: "*.py",
      contains: "Task",
      recursive: true,
      only_files: true,
      case_sensitive: false,
      limit: "200",
      search_all_file_types: false,
      ocr_fallback: true,
      force_ocr: false,
      engine: "auto",
      language: "en",
      max_pages: "",
      content_limit: "200000",
    },
    fields: [
      { name: "root_path", label: "Root path", type: "text", section: "Search target", required: true },
      { name: "pattern", label: "Glob pattern", type: "text", section: "Search target", required: true },
      { name: "contains", label: "Contains text", type: "text", section: "Search target", help: "Leave empty to list matches without content filtering." },
      { name: "recursive", label: "Search recursively", type: "checkbox", section: "Search target" },
      { name: "only_files", label: "Only files", type: "checkbox", section: "Search target" },
      { name: "case_sensitive", label: "Case sensitive", type: "checkbox", section: "Search target" },
      { name: "limit", label: "Match limit", type: "number", section: "Search target" },
      { name: "search_all_file_types", label: "Inspect PDFs and images too", type: "checkbox", section: "Document search" },
      { name: "ocr_fallback", label: "Use OCR fallback", type: "checkbox", section: "Document search" },
      { name: "force_ocr", label: "Force OCR on PDFs", type: "checkbox", section: "Document search" },
      {
        name: "engine",
        label: "OCR engine",
        type: "select",
        section: "Document search",
        options: [
          { value: "auto", label: "Auto" },
          { value: "paddleocr", label: "PaddleOCR" },
          { value: "tesseract", label: "Tesseract" },
        ],
      },
      { name: "language", label: "OCR language", type: "text", section: "Document search" },
      { name: "max_pages", label: "Max PDF pages", type: "number", section: "Document search" },
      { name: "content_limit", label: "Content limit", type: "number", section: "Document search" },
    ],
    buildPayload(values) {
      return compactObject({
        root_path: values.root_path,
        pattern: values.pattern,
        contains: values.contains,
        recursive: Boolean(values.recursive),
        only_files: Boolean(values.only_files),
        case_sensitive: Boolean(values.case_sensitive),
        limit: parseIntegerField(values.limit, "Limit", 200),
        search_all_file_types: Boolean(values.search_all_file_types),
        ocr_fallback: Boolean(values.ocr_fallback),
        force_ocr: Boolean(values.force_ocr),
        engine: values.engine || "auto",
        language: values.language || "en",
        max_pages: parseIntegerField(values.max_pages, "Max pages", undefined),
        content_limit: parseIntegerField(values.content_limit, "Content limit", 200000),
      });
    },
  },
  file_read: {
    note: "Choose the read mode instead of hand-writing JSON. You can upload a file directly into the path field, then tune PDF and OCR controls here.",
    defaults: {
      path: "sample.pdf",
      read_mode: "pdf",
      encoding: "utf-8",
      content_limit: "200000",
      include_pages: true,
      ocr_fallback: true,
      force_ocr: false,
      engine: "auto",
      language: "en",
      max_pages: "3",
      dpi: "220",
      preprocess: true,
      upscale_factor: "1.5",
      threshold: "",
    },
    fields: [
      { name: "path", label: "File path", type: "text", section: "Source", required: true },
      {
        name: "read_mode",
        label: "Read mode",
        type: "select",
        section: "Source",
        options: ["text", "json", "csv", "binary", "pdf", "ocr"].map((value) => ({ value, label: value })),
      },
      { name: "encoding", label: "Encoding", type: "text", section: "Source", when: (values) => ["text", "json", "csv"].includes(values.read_mode) },
      { name: "content_limit", label: "Content limit", type: "number", section: "Output" },
      { name: "include_pages", label: "Include page breakdown", type: "checkbox", section: "Output", when: (values) => ["pdf", "ocr"].includes(values.read_mode) },
      { name: "ocr_fallback", label: "Fallback to OCR", type: "checkbox", section: "OCR options", when: (values) => values.read_mode === "pdf" },
      { name: "force_ocr", label: "Force OCR", type: "checkbox", section: "OCR options", when: (values) => ["pdf", "ocr"].includes(values.read_mode) },
      {
        name: "engine",
        label: "OCR engine",
        type: "select",
        section: "OCR options",
        when: (values) => ["pdf", "ocr"].includes(values.read_mode),
        options: [
          { value: "auto", label: "Auto" },
          { value: "paddleocr", label: "PaddleOCR" },
          { value: "tesseract", label: "Tesseract" },
        ],
      },
      { name: "language", label: "OCR language", type: "text", section: "OCR options", when: (values) => ["pdf", "ocr"].includes(values.read_mode) },
      { name: "max_pages", label: "Max pages", type: "number", section: "OCR options", when: (values) => ["pdf", "ocr"].includes(values.read_mode) },
      { name: "dpi", label: "Render DPI", type: "number", section: "OCR options", when: (values) => ["pdf", "ocr"].includes(values.read_mode) },
      { name: "preprocess", label: "Preprocess image", type: "checkbox", section: "OCR options", when: (values) => ["pdf", "ocr"].includes(values.read_mode) },
      { name: "upscale_factor", label: "Upscale factor", type: "number", section: "OCR options", step: "0.1", when: (values) => ["pdf", "ocr"].includes(values.read_mode) },
      { name: "threshold", label: "Threshold", type: "number", section: "OCR options", when: (values) => ["pdf", "ocr"].includes(values.read_mode) },
    ],
    buildPayload(values) {
      return compactObject({
        path: values.path,
        read_mode: values.read_mode,
        encoding: values.encoding,
        content_limit: parseIntegerField(values.content_limit, "Content limit", 200000),
        include_pages: Boolean(values.include_pages),
        ocr_fallback: Boolean(values.ocr_fallback),
        force_ocr: Boolean(values.force_ocr),
        engine: values.engine || "auto",
        language: values.language || "en",
        max_pages: parseIntegerField(values.max_pages, "Max pages", undefined),
        dpi: parseIntegerField(values.dpi, "DPI", 220),
        preprocess: Boolean(values.preprocess),
        upscale_factor: parseFloatField(values.upscale_factor, "Upscale factor", 1.5),
        threshold: parseIntegerField(values.threshold, "Threshold", undefined),
      });
    },
  },
  file_write: {
    note: "Use the mode switch to show only the fields that backend write mode needs.",
    defaults: {
      path: "output/report.json",
      write_mode: "json",
      encoding: "utf-8",
      append: false,
      content: "Queue completed cleanly.",
      data_input: jsonText({ ok: true }),
      rows_input: jsonText([{ id: 1, status: "queued" }]),
      fieldnames: "id,status",
      content_base64: "",
    },
    fields: [
      { name: "path", label: "Output path", type: "text", section: "Destination", required: true },
      {
        name: "write_mode",
        label: "Write mode",
        type: "select",
        section: "Destination",
        options: ["text", "json", "csv", "binary"].map((value) => ({ value, label: value })),
      },
      { name: "encoding", label: "Encoding", type: "text", section: "Destination", when: (values) => ["text", "json", "csv"].includes(values.write_mode) },
      { name: "append", label: "Append instead of overwrite", type: "checkbox", section: "Destination", when: (values) => values.write_mode === "text" },
      { name: "content", label: "Text content", type: "textarea", section: "Content", span: 2, when: (values) => values.write_mode === "text" },
      { name: "data_input", label: "JSON data", type: "json", section: "Content", span: 2, when: (values) => values.write_mode === "json" },
      { name: "rows_input", label: "CSV rows JSON", type: "json", section: "Content", span: 2, when: (values) => values.write_mode === "csv" },
      { name: "fieldnames", label: "CSV field names", type: "text", section: "Content", when: (values) => values.write_mode === "csv", help: "Comma separated. Optional when rows already include keys." },
      { name: "content_base64", label: "Binary content (base64)", type: "json", section: "Content", span: 2, when: (values) => values.write_mode === "binary" },
    ],
    buildPayload(values) {
      return compactObject({
        path: values.path,
        write_mode: values.write_mode,
        encoding: values.encoding,
        append: Boolean(values.append),
        content: values.write_mode === "text" ? values.content : undefined,
        data: values.write_mode === "json" ? parseJsonField(values.data_input, "JSON data") : undefined,
        rows: values.write_mode === "csv" ? parseJsonField(values.rows_input, "CSV rows", []) : undefined,
        fieldnames: values.write_mode === "csv" ? parseCommaList(values.fieldnames) : undefined,
        content_base64: values.write_mode === "binary" ? String(values.content_base64 || "").trim().replace(/^"|"$/g, "") : undefined,
      });
    },
  },
  csv_processing: {
    note: "Choose either a CSV file path or direct rows JSON. You can upload the CSV straight into the path field and the worker will read that stored file.",
    defaults: {
      source_mode: "path",
      path: "data/jobs.csv",
      rows_input: jsonText([{ duration: 14, status: "completed" }]),
      encoding: "utf-8",
      operation: "aggregate",
      column: "duration",
      value: "",
      agg: "avg",
      reverse: false,
      columns: "duration,status",
    },
    fields: [
      {
        name: "source_mode",
        label: "Source",
        type: "select",
        section: "Data source",
        options: [
          { value: "path", label: "CSV file path" },
          { value: "rows", label: "Rows JSON" },
        ],
      },
      { name: "path", label: "CSV path", type: "text", section: "Data source", when: (values) => values.source_mode === "path", required: true },
      { name: "rows_input", label: "Rows JSON", type: "json", section: "Data source", span: 2, when: (values) => values.source_mode === "rows", required: true },
      { name: "encoding", label: "Encoding", type: "text", section: "Data source", when: (values) => values.source_mode === "path" },
      {
        name: "operation",
        label: "Operation",
        type: "select",
        section: "Processing",
        options: [
          { value: "summary", label: "Summary" },
          { value: "filter", label: "Filter" },
          { value: "aggregate", label: "Aggregate" },
          { value: "sort", label: "Sort" },
          { value: "select_columns", label: "Select columns" },
        ],
      },
      { name: "column", label: "Column", type: "text", section: "Processing", when: (values) => ["filter", "aggregate", "sort"].includes(values.operation) },
      { name: "value", label: "Filter value", type: "text", section: "Processing", when: (values) => values.operation === "filter" },
      {
        name: "agg",
        label: "Aggregate function",
        type: "select",
        section: "Processing",
        when: (values) => values.operation === "aggregate",
        options: ["sum", "avg", "min", "max", "count"].map((value) => ({ value, label: value })),
      },
      { name: "reverse", label: "Reverse sort", type: "checkbox", section: "Processing", when: (values) => values.operation === "sort" },
      { name: "columns", label: "Columns", type: "text", section: "Processing", when: (values) => values.operation === "select_columns", help: "Comma separated." },
    ],
    buildPayload(values) {
      return compactObject({
        path: values.source_mode === "path" ? values.path : undefined,
        rows: values.source_mode === "rows" ? parseJsonField(values.rows_input, "Rows", []) : undefined,
        encoding: values.source_mode === "path" ? values.encoding : undefined,
        operation: values.operation,
        column: ["filter", "aggregate", "sort"].includes(values.operation) ? values.column : undefined,
        value: values.operation === "filter" ? values.value : undefined,
        agg: values.operation === "aggregate" ? values.agg : undefined,
        reverse: values.operation === "sort" ? Boolean(values.reverse) : undefined,
        columns: values.operation === "select_columns" ? parseCommaList(values.columns) : undefined,
      });
    },
  },
  ocr: {
    note: "Upload an image or PDF here, then keep engine on Auto or PaddleOCR and preprocessing on for the best free OCR accuracy on noisy scans.",
    defaults: {
      input_path: "scan.pdf",
      engine: "auto",
      language: "en",
      max_pages: "5",
      dpi: "220",
      preprocess: true,
      use_angle_cls: true,
      upscale_factor: "1.5",
      threshold: "",
      content_limit: "200000",
    },
    fields: [
      { name: "input_path", label: "Image or PDF path", type: "text", section: "Input", required: true },
      {
        name: "engine",
        label: "OCR engine",
        type: "select",
        section: "OCR engine",
        options: [
          { value: "auto", label: "Auto" },
          { value: "paddleocr", label: "PaddleOCR" },
          { value: "tesseract", label: "Tesseract" },
        ],
      },
      { name: "language", label: "Language", type: "text", section: "OCR engine" },
      { name: "max_pages", label: "Max pages", type: "number", section: "Processing" },
      { name: "dpi", label: "Render DPI", type: "number", section: "Processing" },
      { name: "preprocess", label: "Preprocess image", type: "checkbox", section: "Processing" },
      { name: "use_angle_cls", label: "Use angle classifier", type: "checkbox", section: "Processing" },
      { name: "upscale_factor", label: "Upscale factor", type: "number", section: "Processing", step: "0.1" },
      { name: "threshold", label: "Threshold", type: "number", section: "Processing" },
      { name: "content_limit", label: "Content limit", type: "number", section: "Output" },
    ],
    buildPayload(values) {
      return compactObject({
        input_path: values.input_path,
        engine: values.engine,
        language: values.language || "en",
        max_pages: parseIntegerField(values.max_pages, "Max pages", undefined),
        dpi: parseIntegerField(values.dpi, "DPI", 220),
        preprocess: Boolean(values.preprocess),
        use_angle_cls: Boolean(values.use_angle_cls),
        upscale_factor: parseFloatField(values.upscale_factor, "Upscale factor", 1.5),
        threshold: parseIntegerField(values.threshold, "Threshold", undefined),
        content_limit: parseIntegerField(values.content_limit, "Content limit", 200000),
      });
    },
  },
  image_resize: {
    note: "Upload the source image here, then set either exact dimensions or max bounds with aspect ratio kept on.",
    defaults: {
      input_path: "input.jpg",
      output_path: "output/resized.jpg",
      width: "",
      height: "",
      max_width: "1600",
      max_height: "1200",
      keep_aspect_ratio: true,
    },
    fields: [
      { name: "input_path", label: "Input image path", type: "text", section: "Files", required: true },
      { name: "output_path", label: "Output image path", type: "text", section: "Files", required: true },
      { name: "keep_aspect_ratio", label: "Keep aspect ratio", type: "checkbox", section: "Resize settings" },
      { name: "width", label: "Width", type: "number", section: "Resize settings" },
      { name: "height", label: "Height", type: "number", section: "Resize settings" },
      { name: "max_width", label: "Max width", type: "number", section: "Resize settings" },
      { name: "max_height", label: "Max height", type: "number", section: "Resize settings" },
    ],
    buildPayload(values) {
      return compactObject({
        input_path: values.input_path,
        output_path: values.output_path,
        width: parseIntegerField(values.width, "Width", undefined),
        height: parseIntegerField(values.height, "Height", undefined),
        max_width: parseIntegerField(values.max_width, "Max width", undefined),
        max_height: parseIntegerField(values.max_height, "Max height", undefined),
        keep_aspect_ratio: Boolean(values.keep_aspect_ratio),
      });
    },
  },
  image_compress: {
    note: "Upload the source image here. Quality controls output size, and max width and height can also resize during compression.",
    defaults: {
      input_path: "input.jpg",
      output_path: "output/compressed.jpg",
      quality: "78",
      optimize: true,
      format: "",
      max_width: "",
      max_height: "",
    },
    fields: [
      { name: "input_path", label: "Input image path", type: "text", section: "Files", required: true },
      { name: "output_path", label: "Output image path", type: "text", section: "Files", required: true },
      { name: "quality", label: "Quality", type: "number", section: "Compression" },
      { name: "optimize", label: "Optimize output", type: "checkbox", section: "Compression" },
      { name: "format", label: "Output format", type: "text", section: "Compression", placeholder: "jpeg, png, webp, or leave empty" },
      { name: "max_width", label: "Max width", type: "number", section: "Compression" },
      { name: "max_height", label: "Max height", type: "number", section: "Compression" },
    ],
    buildPayload(values) {
      return compactObject({
        input_path: values.input_path,
        output_path: values.output_path,
        quality: parseIntegerField(values.quality, "Quality", 75),
        optimize: Boolean(values.optimize),
        format: values.format,
        max_width: parseIntegerField(values.max_width, "Max width", undefined),
        max_height: parseIntegerField(values.max_height, "Max height", undefined),
      });
    },
  },
  video_to_audio: {
    note: "Upload the source video here or provide a shared path manually. The worker uses ffmpeg underneath.",
    defaults: {
      input_path: "input.mp4",
      output_path: "",
      output_format: "mp3",
      audio_codec: "libmp3lame",
      bitrate: "192k",
      timeout: "600",
    },
    fields: [
      { name: "input_path", label: "Video path", type: "text", section: "Files", required: true },
      { name: "output_path", label: "Output audio path", type: "text", section: "Files", help: "Leave empty to let backend derive it from the video name." },
      { name: "output_format", label: "Output format", type: "text", section: "Encoding" },
      { name: "audio_codec", label: "Audio codec", type: "text", section: "Encoding" },
      { name: "bitrate", label: "Bitrate", type: "text", section: "Encoding" },
      { name: "timeout", label: "Timeout (seconds)", type: "number", section: "Encoding" },
    ],
    buildPayload(values) {
      return compactObject({
        input_path: values.input_path,
        output_path: values.output_path,
        output_format: values.output_format || "mp3",
        audio_codec: values.audio_codec || "libmp3lame",
        bitrate: values.bitrate || "192k",
        timeout: parseIntegerField(values.timeout, "Timeout", 600),
      });
    },
  },
  scrape_website: {
    note: "Use this for page title, links, and preview capture. Keep body limits reasonable on large pages.",
    defaults: {
      url: "https://example.com",
      headers: "{}",
      timeout: "30",
      retries: "2",
      retry_delay: "1",
      max_links: "50",
      preview_limit: "3000",
      body_limit: "200000",
    },
    fields: [
      { name: "url", label: "Page URL", type: "text", section: "Target", required: true },
      { name: "headers", label: "Headers JSON", type: "json", section: "Target", span: 2 },
      { name: "timeout", label: "Timeout (seconds)", type: "number", section: "Runtime" },
      { name: "retries", label: "Retries", type: "number", section: "Runtime" },
      { name: "retry_delay", label: "Retry delay (seconds)", type: "number", section: "Runtime", step: "0.1" },
      { name: "max_links", label: "Max links", type: "number", section: "Output" },
      { name: "preview_limit", label: "Preview limit", type: "number", section: "Output" },
      { name: "body_limit", label: "Body limit", type: "number", section: "Output" },
    ],
    buildPayload(values) {
      return compactObject({
        url: values.url,
        headers: parseJsonField(values.headers, "Headers", {}),
        timeout: parseIntegerField(values.timeout, "Timeout", 30),
        retries: parseIntegerField(values.retries, "Retries", 1),
        retry_delay: parseFloatField(values.retry_delay, "Retry delay", 1),
        max_links: parseIntegerField(values.max_links, "Max links", 50),
        preview_limit: parseIntegerField(values.preview_limit, "Preview limit", 3000),
        body_limit: parseIntegerField(values.body_limit, "Body limit", 200000),
      });
    },
  },
  scrape_product: {
    note: "Optimized for product pages and price extraction. You can swap the regex if the site uses a different price format.",
    defaults: {
      url: "https://example.com/product/sku-01",
      headers: "{}",
      timeout: "30",
      retries: "1",
      retry_delay: "1",
      price_regex: "",
      max_prices: "20",
      body_limit: "200000",
    },
    fields: [
      { name: "url", label: "Product URL", type: "text", section: "Target", required: true },
      { name: "headers", label: "Headers JSON", type: "json", section: "Target", span: 2 },
      { name: "timeout", label: "Timeout (seconds)", type: "number", section: "Runtime" },
      { name: "retries", label: "Retries", type: "number", section: "Runtime" },
      { name: "retry_delay", label: "Retry delay (seconds)", type: "number", section: "Runtime", step: "0.1" },
      { name: "price_regex", label: "Price regex", type: "text", section: "Extraction" },
      { name: "max_prices", label: "Max prices", type: "number", section: "Extraction" },
      { name: "body_limit", label: "Body limit", type: "number", section: "Extraction" },
    ],
    buildPayload(values) {
      return compactObject({
        url: values.url,
        headers: parseJsonField(values.headers, "Headers", {}),
        timeout: parseIntegerField(values.timeout, "Timeout", 30),
        retries: parseIntegerField(values.retries, "Retries", 1),
        retry_delay: parseFloatField(values.retry_delay, "Retry delay", 1),
        price_regex: values.price_regex,
        max_prices: parseIntegerField(values.max_prices, "Max prices", 20),
        body_limit: parseIntegerField(values.body_limit, "Body limit", 200000),
      });
    },
  },
  send_email: {
    note: "Upload attachments directly from the browser or paste existing worker-accessible file paths manually.",
    defaults: {
      smtp_host: "smtp.example.com",
      smtp_port: "587",
      username: "",
      password: "",
      use_tls: true,
      from_email: "ops@example.com",
      to_email: "team@example.com",
      subject: "Queue alert",
      body: "A worker completed a critical job.",
      html_body: "",
      attachments: "",
      dry_run: true,
    },
    fields: [
      { name: "smtp_host", label: "SMTP host", type: "text", section: "SMTP", required: true },
      { name: "smtp_port", label: "SMTP port", type: "number", section: "SMTP" },
      { name: "username", label: "SMTP username", type: "text", section: "SMTP" },
      { name: "password", label: "SMTP password", type: "text", section: "SMTP" },
      { name: "use_tls", label: "Use TLS", type: "checkbox", section: "SMTP" },
      { name: "from_email", label: "From email", type: "text", section: "Message", required: true },
      { name: "to_email", label: "To email", type: "text", section: "Message", required: true },
      { name: "subject", label: "Subject", type: "text", section: "Message", required: true },
      { name: "body", label: "Plain text body", type: "textarea", section: "Message", span: 2 },
      { name: "html_body", label: "HTML body", type: "textarea", section: "Message", span: 2 },
      { name: "attachments", label: "Attachment paths", type: "textarea", section: "Message", span: 2, help: "One path per line." },
      { name: "dry_run", label: "Dry run only", type: "checkbox", section: "Message" },
    ],
    buildPayload(values) {
      return compactObject({
        smtp_host: values.smtp_host,
        smtp_port: parseIntegerField(values.smtp_port, "SMTP port", 587),
        username: values.username,
        password: values.password,
        use_tls: Boolean(values.use_tls),
        from_email: values.from_email,
        to_email: values.to_email,
        subject: values.subject,
        body: values.body,
        html_body: values.html_body,
        attachments: parseLineList(values.attachments),
        dry_run: Boolean(values.dry_run),
      });
    },
  },
  send_sms: {
    note: "The provider request is still JSON underneath, but this form keeps the common pieces visible.",
    defaults: {
      provider_url: "https://example.com/sms",
      to: "+10000000000",
      message: "Queue drift detected",
      headers: "{}",
      extra_payload: "{}",
      timeout: "30",
      retries: "1",
      retry_delay: "1",
      body_limit: "200000",
      dry_run: true,
    },
    fields: [
      { name: "provider_url", label: "Provider URL", type: "text", section: "Target", required: true },
      { name: "to", label: "Recipient number", type: "text", section: "Target", required: true },
      { name: "message", label: "Message", type: "textarea", section: "Target", span: 2, required: true },
      { name: "headers", label: "Headers JSON", type: "json", section: "Request details", span: 2 },
      { name: "extra_payload", label: "Extra payload JSON", type: "json", section: "Request details", span: 2 },
      { name: "timeout", label: "Timeout (seconds)", type: "number", section: "Runtime" },
      { name: "retries", label: "Retries", type: "number", section: "Runtime" },
      { name: "retry_delay", label: "Retry delay (seconds)", type: "number", section: "Runtime", step: "0.1" },
      { name: "body_limit", label: "Body limit", type: "number", section: "Runtime" },
      { name: "dry_run", label: "Dry run only", type: "checkbox", section: "Runtime" },
    ],
    buildPayload(values) {
      return compactObject({
        provider_url: values.provider_url,
        to: values.to,
        message: values.message,
        headers: parseJsonField(values.headers, "Headers", {}),
        extra_payload: parseJsonField(values.extra_payload, "Extra payload", {}),
        timeout: parseIntegerField(values.timeout, "Timeout", 30),
        retries: parseIntegerField(values.retries, "Retries", 1),
        retry_delay: parseFloatField(values.retry_delay, "Retry delay", 1),
        body_limit: parseIntegerField(values.body_limit, "Body limit", 200000),
        dry_run: Boolean(values.dry_run),
      });
    },
  },
  run_command: {
    note: "Use shell mode for normal command strings. Turn shell mode off only if you know the backend should interpret the command value differently.",
    defaults: {
      command: "python --version",
      shell: true,
      cwd: "",
      timeout: "60",
      output_limit: "100000",
      env_input: "{}",
    },
    fields: [
      { name: "command", label: "Command", type: "textarea", section: "Execution", span: 2, required: true },
      { name: "shell", label: "Run in shell", type: "checkbox", section: "Execution" },
      { name: "cwd", label: "Working directory", type: "text", section: "Execution" },
      { name: "timeout", label: "Timeout (seconds)", type: "number", section: "Limits" },
      { name: "output_limit", label: "Output limit", type: "number", section: "Limits" },
      { name: "env_input", label: "Environment JSON", type: "json", section: "Limits", span: 2 },
    ],
    buildPayload(values) {
      return compactObject({
        command: values.command,
        shell: Boolean(values.shell),
        cwd: values.cwd,
        timeout: parseIntegerField(values.timeout, "Timeout", 60),
        output_limit: parseIntegerField(values.output_limit, "Output limit", 100000),
        env: parseJsonField(values.env_input, "Environment", {}),
      });
    },
  },
  code_execution: {
    note: "Inline mode runs Python code directly. Script mode lets you upload a script file or point the worker to an existing script path.",
    defaults: {
      execution_mode: "inline",
      code: "print('queue ready')",
      script_path: "",
      args: "",
      stdin: "",
      cwd: "",
      timeout: "20",
      output_limit: "100000",
      env_input: "{}",
    },
    fields: [
      {
        name: "execution_mode",
        label: "Execution mode",
        type: "select",
        section: "Source",
        options: [
          { value: "inline", label: "Inline code" },
          { value: "script", label: "Script path" },
        ],
      },
      { name: "code", label: "Python code", type: "textarea", section: "Source", span: 2, when: (values) => values.execution_mode === "inline", required: true },
      { name: "script_path", label: "Script path", type: "text", section: "Source", when: (values) => values.execution_mode === "script", required: true },
      { name: "args", label: "Args", type: "text", section: "Runtime", help: "Comma separated." },
      { name: "stdin", label: "Standard input", type: "textarea", section: "Runtime", span: 2 },
      { name: "cwd", label: "Working directory", type: "text", section: "Runtime" },
      { name: "timeout", label: "Timeout (seconds)", type: "number", section: "Limits" },
      { name: "output_limit", label: "Output limit", type: "number", section: "Limits" },
      { name: "env_input", label: "Environment JSON", type: "json", section: "Limits", span: 2 },
    ],
    buildPayload(values) {
      return compactObject({
        code: values.execution_mode === "inline" ? values.code : undefined,
        script_path: values.execution_mode === "script" ? values.script_path : undefined,
        args: parseCommaList(values.args),
        stdin: values.stdin,
        cwd: values.cwd,
        timeout: parseIntegerField(values.timeout, "Timeout", 30),
        output_limit: parseIntegerField(values.output_limit, "Output limit", 100000),
        env: parseJsonField(values.env_input, "Environment", {}),
      });
    },
  },
  log_analysis: {
    note: "Upload a log file or point the task at one the worker can reach, then add the keywords you care about most.",
    defaults: {
      path: "logs/app.log",
      keywords: "ERROR,timeout",
      error_sample_limit: "5",
      encoding: "utf-8",
    },
    fields: [
      { name: "path", label: "Log file path", type: "text", section: "Source", required: true },
      { name: "keywords", label: "Keywords", type: "text", section: "Source", help: "Comma separated." },
      { name: "error_sample_limit", label: "Error sample limit", type: "number", section: "Analysis" },
      { name: "encoding", label: "Encoding", type: "text", section: "Analysis" },
    ],
    buildPayload(values) {
      return compactObject({
        path: values.path,
        keywords: parseCommaList(values.keywords),
        error_sample_limit: parseIntegerField(values.error_sample_limit, "Error sample limit", 20),
        encoding: values.encoding || "utf-8",
      });
    },
  },
  backup_database: {
    note: "Use filesystem mode for files or folders, with optional file upload for single sources. Use PostgreSQL mode to trigger pg_dump with a connection URL.",
    defaults: {
      backup_mode: "filesystem",
      source_path: "data",
      postgres_url: "postgresql://postgres:postgres@postgres:5433/jobqueue",
      backup_path: "backups/data_snapshot.zip",
      archive_format: "zip",
      timeout: "600",
    },
    fields: [
      {
        name: "backup_mode",
        label: "Backup mode",
        type: "select",
        section: "Source",
        options: [
          { value: "filesystem", label: "File or directory" },
          { value: "postgres", label: "PostgreSQL dump" },
        ],
      },
      { name: "source_path", label: "Source path", type: "text", section: "Source", when: (values) => values.backup_mode === "filesystem", required: true },
      { name: "postgres_url", label: "Postgres URL", type: "text", section: "Source", when: (values) => values.backup_mode === "postgres", required: true },
      { name: "backup_path", label: "Backup output path", type: "text", section: "Destination" },
      {
        name: "archive_format",
        label: "Archive format",
        type: "select",
        section: "Destination",
        when: (values) => values.backup_mode === "filesystem",
        options: ["zip", "tar", "gztar", "bztar", "xztar"].map((value) => ({ value, label: value })),
      },
      { name: "timeout", label: "Timeout (seconds)", type: "number", section: "Destination", when: (values) => values.backup_mode === "postgres" },
    ],
    buildPayload(values) {
      return compactObject({
        source_path: values.backup_mode === "filesystem" ? values.source_path : undefined,
        postgres_url: values.backup_mode === "postgres" ? values.postgres_url : undefined,
        backup_path: values.backup_path,
        archive_format: values.backup_mode === "filesystem" ? values.archive_format : undefined,
        timeout: values.backup_mode === "postgres" ? parseIntegerField(values.timeout, "Timeout", 600) : undefined,
      });
    },
  },
};

const uploadFieldDefinitions = {
  file_read: {
    path: {
      upload: {
        accept: ".pdf,.txt,.csv,.json,.log,.md,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff",
      },
    },
  },
  csv_processing: {
    path: {
      upload: {
        accept: ".csv,text/csv",
      },
    },
  },
  ocr: {
    input_path: {
      upload: {
        accept: ".pdf,image/*",
      },
    },
  },
  image_resize: {
    input_path: {
      upload: {
        accept: "image/*",
      },
    },
  },
  image_compress: {
    input_path: {
      upload: {
        accept: "image/*",
      },
    },
  },
  video_to_audio: {
    input_path: {
      upload: {
        accept: "video/*,.mkv,.avi,.mov,.webm",
      },
    },
  },
  code_execution: {
    script_path: {
      upload: {
        accept: ".py,.txt",
      },
    },
  },
  log_analysis: {
    path: {
      upload: {
        accept: ".log,.txt,.json",
      },
    },
  },
  backup_database: {
    source_path: {
      upload: {
        accept: ".zip,.tar,.gz,.sql,.dump,.bak",
      },
    },
  },
  send_email: {
    attachments: {
      upload: {
        mode: "multiple",
        append: true,
        help: "Uploaded files are appended to the attachment path list automatically.",
      },
    },
  },
};

Object.entries(uploadFieldDefinitions).forEach(([taskType, overrides]) => {
  const form = taskForms[taskType];
  if (!form) {
    return;
  }

  form.fields = form.fields.map((field) => {
    const fieldOverride = overrides[field.name];
    return fieldOverride ? { ...field, ...fieldOverride } : field;
  });
});

export function getTaskForm(type) {
  return taskForms[type] || taskForms.api_fetch;
}

export function createTaskFormState(type) {
  return { ...getTaskForm(type).defaults };
}

export function buildPayloadFromTaskForm(type, values) {
  return getTaskForm(type).buildPayload(values);
}
