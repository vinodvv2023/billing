"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("token", token);
      alert("Successfully authenticated via OAuth! Token saved to localStorage.");
    } else if (searchParams.toString().length > 0) {
      alert("Authentication failed: No valid token received.");
    }
    // Redirect to home or dashboard
    router.push("/");
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
        <p className="text-sm font-medium animate-pulse text-zinc-400">Authenticating securely...</p>
      </div>
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
