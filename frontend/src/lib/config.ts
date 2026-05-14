const fallbackApiUrl = process.env.NODE_ENV === "production" ? "" : "http://localhost:8000";

export const appConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? fallbackApiUrl,
  cookieMode: (process.env.NEXT_PUBLIC_COOKIE_MODE ?? "false").toLowerCase() === "true",
  csrfHeaderName: "X-CSRF-Token",
};

/**
 * Optionally build default fetch options when cookie mode is enabled.
 * Backend must set HttpOnly cookie + issue a CSRF token header/value.
 */
export const buildAuthHeaders = (csrfToken?: string) => {
  if (!appConfig.cookieMode) return {};
  return {
    credentials: "include" as const,
    headers: csrfToken ? { [appConfig.csrfHeaderName]: csrfToken } : {},
  };
};
