"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/ui/card";
import { useToast } from "@/ui/toast";
import { useSession } from "@/lib/session";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const { setToken } = useSession();

  useEffect(() => {
    const token = searchParams.get("token");
    const redirect = searchParams.get("redirect") || "/dashboard";
    if (token) {
      setToken(token);
      push({
        title: "Signed in",
        description: "OAuth token saved to your device.",
        variant: "success",
        duration: 2400,
      });
      router.replace(redirect);
    } else if (searchParams.toString().length > 0) {
      push({
        title: "Authentication failed",
        description: "No valid token received from provider.",
        variant: "error",
        duration: 4000,
      });
      router.replace("/");
    }
  }, [searchParams, router, push, setToken]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <Card className="max-w-sm w-full text-center">
        <CardContent className="py-10 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-200">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-white">Completing sign-in</h2>
            <p className="text-sm text-white/60">We’re finalizing your OAuth session and redirecting you.</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-white/60">
            <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
            <span className="text-xs uppercase tracking-[0.2em]">Secure redirect</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="bg-black min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-white w-8 h-8"/></div>}>
      <CallbackHandler />
    </Suspense>
  );
}
