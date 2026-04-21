"use client";

import { useMemo } from "react";
import { useSession } from "./session";
import { decodeJwt, type JWTPayload } from "jose";

export type Me = {
  email?: string;
  roles: string[];
  full_name?: string;
  userId?: number | null;
};

type SessionPayload = JWTPayload & {
  roles?: string[];
  full_name?: string;
  uid?: number;
};

export function useMe(): Me {
  const { token, roles } = useSession();
  return useMemo(() => {
    if (!token) return { roles: [] };
    try {
      const decoded = decodeJwt(token) as SessionPayload;
      return {
        email: decoded.sub,
        roles: decoded.roles || roles || [],
        full_name: decoded.full_name,
        userId: typeof decoded.uid === "number" ? decoded.uid : null,
      };
    } catch {
      return { roles: roles || [] };
    }
  }, [token, roles]);
}
