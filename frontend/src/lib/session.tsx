"use client";

import * as React from "react";

type SessionContextType = {
  token: string | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
  roles: string[];
  userId: number | null;
  activeOrganizationId: number | null;
  setActiveOrganizationId: (organizationId: number | null) => void;
};

const SessionContext = React.createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = React.useState<string | null>(null);
  const [roles, setRoles] = React.useState<string[]>([]);
  const [userId, setUserId] = React.useState<number | null>(null);
  const [activeOrganizationId, setActiveOrganizationIdState] = React.useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("active_organization_id");
    if (!stored) return null;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
  });

  const extractClaims = React.useCallback((jwt?: string | null) => {
    if (!jwt) return { roles: [], userId: null };
    try {
      const parts = jwt.split(".");
      if (parts.length < 2) return { roles: [], userId: null };
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      const claimRoles = payload?.roles ?? payload?.role ?? [];
      const roles = Array.isArray(claimRoles)
        ? claimRoles
        : typeof claimRoles === "string"
        ? [claimRoles]
        : [];
      const userId = typeof payload?.uid === "number" ? payload.uid : null;
      return { roles, userId };
    } catch {
      return { roles: [], userId: null };
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("token");
    if (stored) setTokenState(stored);
    const { roles, userId } = extractClaims(stored);
    setRoles(roles);
    setUserId(userId);
  }, [extractClaims]);

  const setToken = React.useCallback((newToken: string | null) => {
    setTokenState(newToken);
    const { roles, userId } = extractClaims(newToken);
    setRoles(roles);
    setUserId(userId);
    if (typeof window !== "undefined") {
      if (newToken) localStorage.setItem("token", newToken);
      else localStorage.removeItem("token");
    }
  }, [extractClaims]);

  const logout = React.useCallback(() => {
    setToken(null);
    setActiveOrganizationIdState(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("active_organization_id");
    }
  }, [setToken]);

  const setActiveOrganizationId = React.useCallback((organizationId: number | null) => {
    setActiveOrganizationIdState(organizationId);
    if (typeof window !== "undefined") {
      if (organizationId == null) localStorage.removeItem("active_organization_id");
      else localStorage.setItem("active_organization_id", String(organizationId));
    }
  }, []);

  const value = React.useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      setToken,
      logout,
      roles,
      userId,
      activeOrganizationId,
      setActiveOrganizationId,
    }),
    [token, setToken, logout, roles, userId, activeOrganizationId, setActiveOrganizationId]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
