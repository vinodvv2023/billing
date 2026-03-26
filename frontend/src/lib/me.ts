"use client";

import { useEffect, useState } from "react";
import { useSession } from "./session";
import { decodeJwt } from "jose";

export type Me = {
  email?: string;
  roles: string[];
  full_name?: string;
  userId?: number | null;
};

export function useMe(): Me {
  const { token, roles } = useSession();
  const [me, setMe] = useState<Me>({ roles: roles ?? [] });

  useEffect(() => {
    if (!token) {
      setMe({ roles: [] });
      return;
    }
    try {
      const decoded: any = decodeJwt(token);
      setMe({
        email: decoded?.sub,
        roles: (decoded?.roles as string[]) || roles || [],
        full_name: decoded?.full_name,
        userId: typeof decoded?.uid === "number" ? decoded.uid : null,
      });
    } catch {
      setMe({ roles: roles || [] });
    }
  }, [token, roles]);

  return me;
}
