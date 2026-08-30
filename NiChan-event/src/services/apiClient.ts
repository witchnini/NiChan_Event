// ============================================================
// API CLIENT — NiChan Event
// Fetch wrapper với JWT auth, error handling, và response parsing
// ============================================================

const API_BASE = "/api";

export type ApiResponse<T> = {
  success: true;
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ApiError = {
  code: string;
  message: string;
  details?: { field: string; message: string }[];
};

export class ApiException extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiException";
  }
}

function getToken(): string | null {
  return localStorage.getItem("nichan_token");
}

async function requestResponse<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Build URL with query params
  let url = `${API_BASE}${path}`;
  if (params) {
    const q = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (q) url += `?${q}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({ success: false, error: { code: "PARSE_ERROR", message: "Invalid JSON response" } }));

  if (!json.success) {
    const err = json.error as ApiError;
    throw new ApiException(err.code ?? "UNKNOWN", err.message ?? "Request failed", res.status, err.details);
  }

  return json as ApiResponse<T>;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const response = await requestResponse<T>(method, path, body, params);
  return response.data;
}

async function uploadRequest<T>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: form });
  const json = await res
    .json()
    .catch(() => ({ success: false, error: { code: "PARSE_ERROR", message: "Invalid JSON response" } }));

  if (!json.success) {
    const err = json.error as ApiError;
    throw new ApiException(err.code ?? "UNKNOWN", err.message ?? "Upload failed", res.status, err.details);
  }

  return json.data as T;
}

export const apiClient = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>("GET", path, undefined, params),
  getPaginated: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    requestResponse<T>("GET", path, undefined, params),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => uploadRequest<T>(path, form),
};
