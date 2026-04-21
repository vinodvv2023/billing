"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";
import { defaultRouteForRoles } from "@/lib/role-routing";
import { useSession } from "@/lib/session";
import { useToast } from "@/ui/toast";
import { appConfig } from "@/lib/config";
import { Loader2 } from "lucide-react";

function MagicLinkContent() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { setToken } = useSession();
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    if (!token) {
      setError("Missing token");
      setLoading(false);
      return;
    }
    fetch(`${appConfig.apiUrl}/auth/magic/validate?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Invalid or expired link");
        }
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setEmail(data.email);
      })
      .catch((err) => {
        if (!active) return;
        setError(String(err.message || err));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${appConfig.apiUrl}/auth/magic/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to activate");
      }
      const data = await res.json();
      const tokenParts = String(data.access_token ?? "").split(".");
      const payload = tokenParts.length >= 2 ? JSON.parse(atob(tokenParts[1].replace(/-/g, "+").replace(/_/g, "/"))) : {};
      const claimRoles = Array.isArray(payload?.roles) ? payload.roles : typeof payload?.role === "string" ? [payload.role] : [];
      setToken(data.access_token);
      toast.push({ title: "Account activated", variant: "success" });
      router.push(defaultRouteForRoles(claimRoles));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <Badge tone="outline" className="w-fit">Invite link</Badge>
          <CardTitle>Activate your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {!loading && !error && (
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="text-sm text-white/70">Signing in as</div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold">{email}</div>
              <Input
                type="password"
                required
                minLength={8}
                placeholder="Set a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full" isLoading={submitting} disabled={submitting}>
                Set password & continue
              </Button>
              <div className="text-xs text-white/50">Link expires 24 hours after it was issued.</div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg)] text-white flex items-center justify-center px-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
        </div>
      }
    >
      <MagicLinkContent />
    </Suspense>
  );
}
