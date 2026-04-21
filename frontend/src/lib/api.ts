import { appConfig } from "./config";

async function request<T>(path: string, options?: RequestInit & { csrfToken?: string }) {
  const url = `${appConfig.apiUrl}${path}`;

  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  // Attach bearer token from localStorage if present and not already set
  if (!headers.has("Authorization") && typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (appConfig.cookieMode && options?.csrfToken) {
    headers.set(appConfig.csrfHeaderName, options.csrfToken);
  }

  const finalOptions: RequestInit = {
    method: options?.method ?? "GET",
    headers,
    body: options?.body,
  };

  if (appConfig.cookieMode) {
    finalOptions.credentials = "include";
  }

  const res = await fetch(url, finalOptions);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.detail || data?.message || "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, csrfToken?: string) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body), csrfToken }),
  put: <T>(path: string, body?: unknown, csrfToken?: string) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body), csrfToken }),
  patch: <T>(path: string, body?: unknown, csrfToken?: string) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body), csrfToken }),
  delete: <T>(path: string, csrfToken?: string) =>
    request<T>(path, { method: "DELETE", csrfToken }),
};
