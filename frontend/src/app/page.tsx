"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { motion } from "framer-motion";
import { LoginForm } from "@/components/LoginForm";
import { OAuthButton } from "@/components/OAuthButton";
import { loginLocal, registerLocal } from "@/lib/auth-client";
import { appConfig } from "@/lib/config";
import { getLastOAuthProvider, setLastOAuthProvider } from "@/lib/last-login";
import { defaultRouteForRoles } from "@/lib/role-routing";
import { useSession } from "@/lib/session";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Authentication failed";
}

export default function Home() {
  const router = useRouter();
  const { setToken, roles } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOAuth, setLastOAuth] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      router.replace(defaultRouteForRoles(roles));
    }
    setLastOAuth(getLastOAuthProvider());
  }, [roles, router]);

  const handleLocalAuth = async (email: string, pass: string, isRegister: boolean, role?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const token = isRegister ? await registerLocal(email, pass, role) : await loginLocal(email, pass);
      const parts = token.split(".");
      const payload = parts.length >= 2 ? JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) : {};
      const claimRoles = Array.isArray(payload?.roles) ? payload.roles : typeof payload?.role === "string" ? [payload.role] : [];
      setToken(token);
      router.replace(defaultRouteForRoles(claimRoles));
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: string) => {
    setLastOAuthProvider(provider);
    window.location.href = `${appConfig.apiUrl}/auth/${provider}/login`;
  };

  const GoogleIcon = <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>;
  const GithubIcon = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>;
  const MicrosoftIcon = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/></svg>;
  const TwitterIcon = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>;

  const proofPoints = [
    {
      icon: <ShieldCheck className="h-4 w-4" />,
      title: "Finance-safe access",
      body: "Local auth and OAuth share one role-aware flow so delivery, finance, and client users enter through one gate.",
    },
    {
      icon: <Workflow className="h-4 w-4" />,
      title: "Ready for billing ops",
      body: "Move from sign-in to scoped clients, timesheets, and invoicing without forcing teams through separate tooling.",
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      title: "Built for scale",
      body: "Clear states, stronger hierarchy, and reusable primitives make finance-heavy product work cheaper to extend.",
    },
  ];

  return (
    <main className="relative min-h-screen w-full overflow-hidden px-4 py-8 sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-0 h-[32rem] w-[32rem] rounded-full bg-amber-400/14 blur-[150px]" />
        <div className="absolute right-[-8rem] top-[18%] h-[30rem] w-[30rem] rounded-full bg-sky-400/12 blur-[180px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.18]" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-[1440px] gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <motion.div
          initial={{ opacity: 0, x: -35 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8 rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-8 lg:p-10"
        >
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">
              Billing operations workspace
            </div>
            <div className="max-w-3xl space-y-5">
              <h1 className="max-w-2xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
                Client billing, timesheets, and access control in one focused command surface.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
                Unified local sign-in and OAuth entry points with a cleaner finance-ops experience for teams who need
                to move from delivery to invoice without losing control.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {proofPoints.map((point) => (
              <div
                key={point.title}
                className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] p-2 text-amber-200">
                  {point.icon}
                </div>
                <div className="mt-4 space-y-2">
                  <h2 className="text-base font-semibold tracking-[-0.02em] text-white">{point.title}</h2>
                  <p className="text-sm leading-6 text-white/62">{point.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(255,255,255,0.03))] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Why teams switch</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">Less friction, more confidence</h2>
                </div>
                <ArrowUpRight className="h-5 w-5 text-amber-200" />
              </div>
              <div className="mt-6 space-y-3">
                {[
                  "Role-aware onboarding for Super Admins, Agencies, and Companies.",
                  "Accessible forms, clearer validation, and predictable provider actions.",
                  "A scalable visual system that carries straight into clients, timesheets, and billing surfaces.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-white/72">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-amber-200" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/10 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Operational rhythm</p>
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="text-sm text-white/62">Authentication paths</span>
                  <span className="font-mono text-sm text-white">4 providers</span>
                </div>
                <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="text-sm text-white/62">Timesheet approvals</span>
                  <span className="font-mono text-sm text-white">Built in</span>
                </div>
                <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="text-sm text-white/62">Invoice drafting</span>
                  <span className="font-mono text-sm text-white">Built in</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="w-full xl:sticky xl:top-8 xl:self-start">
          <div className="mx-auto w-full max-w-xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-5">
            <LoginForm
              onLogin={(e, p) => handleLocalAuth(e, p, false)}
              onRegister={(e, p, r) => handleLocalAuth(e, p, true, r)}
              isLoading={isLoading}
              error={error}
            />
          </div>

          <div className="mx-auto mt-6 w-full max-w-xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[var(--shadow-md)] backdrop-blur-xl">
            {lastOAuth && (
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                Last signed in with {lastOAuth.charAt(0).toUpperCase() + lastOAuth.slice(1)}
              </div>
            )}

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10" />
              <span className="mx-4 flex-shrink-0 text-xs uppercase tracking-[0.22em] text-white/45">
                Or continue with
              </span>
              <div className="flex-grow border-t border-white/10" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <OAuthButton provider="google" label="Google" icon={GoogleIcon} onClick={() => handleOAuth("google")} isHighlighted={lastOAuth === "google"} />
              <OAuthButton provider="github" label="GitHub" icon={GithubIcon} onClick={() => {}} className="opacity-40 pointer-events-none" />
              <OAuthButton provider="microsoft" label="Microsoft" icon={MicrosoftIcon} onClick={() => {}} className="opacity-40 pointer-events-none" />
              <OAuthButton provider="twitter" label="Twitter" icon={TwitterIcon} onClick={() => {}} className="opacity-40 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
