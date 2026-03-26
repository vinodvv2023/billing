export const LAST_OAUTH_COOKIE = "last_oauth_provider";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function setLastOAuthProvider(provider: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${LAST_OAUTH_COOKIE}=${encodeURIComponent(provider)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function getLastOAuthProvider(): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LAST_OAUTH_COOKIE}=`));
  if (!cookie) return null;
  return decodeURIComponent(cookie.split("=")[1] || "");
}
