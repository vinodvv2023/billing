import { api } from "./api";

type TokenResponse = { access_token: string; token_type: string };
const fallbackApiUrl = process.env.NODE_ENV === "production" ? "" : "http://localhost:8000";

export async function loginLocal(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${apiBase()}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || "Authentication failed");
  return data.access_token as string;
}

export async function registerLocal(email: string, password: string, role?: string): Promise<string> {
  const data = await api.post<TokenResponse>("/auth/register", { email, password, role });
  return data.access_token;
}

// Helper to reuse the api base without importing config elsewhere
function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? fallbackApiUrl;
}
