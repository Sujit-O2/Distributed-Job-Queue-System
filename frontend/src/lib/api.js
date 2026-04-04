const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = new Headers(options.headers || {});

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(
      "Cannot reach the backend API. Start the app server and check VITE_PROXY_TARGET or docker-compose port mapping.",
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : payload?.detail || payload?.message || "Request failed";
    throw new Error(message);
  }

  return payload;
}

export const api = {
  health: () => request("/health", { method: "GET" }),
  login: (body) =>
    request("/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  register: (body) =>
    request("/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listJobs: (userId) => request(`/list_jobs?user_id=${encodeURIComponent(userId)}`, { method: "GET" }),
  getJobInfo: (jobId) => request(`/job_info?job_id=${encodeURIComponent(jobId)}`, { method: "GET" }),
  createJob: (body) =>
    request("/create_job", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  uploadFiles: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    return request("/upload_files", {
      method: "POST",
      body: formData,
    });
  },
  updateJobStatus: (jobId, status) =>
    request(
      `/update_job_status?job_id=${encodeURIComponent(jobId)}&status=${encodeURIComponent(status)}`,
      { method: "PUT" },
    ),
  deleteJob: (jobId) =>
    request(`/delete_job?job_id=${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    }),
};
