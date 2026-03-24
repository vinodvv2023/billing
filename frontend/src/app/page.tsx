"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { OAuthButton } from "@/components/OAuthButton";
import { motion } from "framer-motion";

const BACKEND_URL = "http://localhost:8000";

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocalAuth = async (email: string, pass: string, isRegister: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/token";
      
      const body = isRegister 
        ? JSON.stringify({ email, password: pass })
        : new URLSearchParams({ username: email, password: pass });
        
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: isRegister 
          ? { "Content-Type": "application/json" }
          : { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      // Success
      localStorage.setItem("token", data.access_token);
      alert("Authenticated successfully! Token saved.");
      // router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: string) => {
    window.location.href = `${BACKEND_URL}/auth/${provider}/login`;
  };

  const GoogleIcon = <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>;
  const GithubIcon = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>;
  const MicrosoftIcon = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/></svg>;
  const TwitterIcon = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>;


  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black flex items-center justify-center p-4 sm:p-8">
      {/* Premium Animated Background Gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[40%] -left-[10%] w-[70%] h-[70%] rounded-full bg-cyan-900/30 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-900/20 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        
        {/* Left Side: Branding / Intro */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="hidden lg:flex flex-col gap-6"
        >
          <div className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 backdrop-blur-md w-fit">
            ✨ Next Generation Authentication
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-white leading-tight">
            Secure, fast, and <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              seamless access.
            </span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
            Experience frictionless login with standard credentials or instantly connect using your favorite social identity providers.
          </p>
        </motion.div>

        {/* Right Side: Auth Forms */}
        <div className="w-full flex flex-col items-center">
          <LoginForm 
            onLogin={(e, p) => handleLocalAuth(e, p, false)} 
            onRegister={(e, p) => handleLocalAuth(e, p, true)}
            isLoading={isLoading}
            error={error}
          />

          <div className="mt-8 w-full max-w-md">
            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="mx-4 flex-shrink-0 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                Or continue with
              </span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <OAuthButton 
                provider="google" 
                label="Google" 
                icon={GoogleIcon} 
                onClick={() => handleOAuth("google")} 
              />
              <OAuthButton 
                provider="github" 
                label="GitHub" 
                icon={GithubIcon} 
                onClick={() => handleOAuth("github")} 
              />
              <OAuthButton 
                provider="microsoft" 
                label="Microsoft" 
                icon={MicrosoftIcon} 
                onClick={() => handleOAuth("microsoft")} 
              />
              <OAuthButton 
                provider="twitter" 
                label="Twitter" 
                icon={TwitterIcon} 
                onClick={() => handleOAuth("twitter")} 
              />
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
