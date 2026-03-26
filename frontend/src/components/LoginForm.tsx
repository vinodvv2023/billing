"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";
import { Badge } from "@/ui/badge";

interface LoginFormProps {
  onLogin: (e: string, p: string) => Promise<void>;
  onRegister: (e: string, p: string, role?: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export function LoginForm({ onLogin, onRegister, isLoading, error }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [accountType, setAccountType] = useState<"individual" | "company" | "agency">("individual");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
      const roleMap = {
        individual: "Individual User",
        company: "Company Admin",
        agency: "Agency Admin",
      };
      await onRegister(email, password, roleMap[accountType]);
    } else {
      await onLogin(email, password);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md"
    >
      <Card className="backdrop-blur border-white/12 bg-[#0b1220]/90 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
        <CardHeader className="items-start text-left">
          <Badge className="mb-3 whitespace-nowrap" tone="outline">
            Secure access
          </Badge>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              {isRegistering ? "Create account" : "Welcome back"}
            </CardTitle>
            <p className="text-sm text-white/60">
              {isRegistering ? "Sign up to get started" : "Enter your credentials to access your account"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-amber-50/90">Account type</div>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: "individual", label: "Individual account", desc: "Create one company, multiple projects" },
                    { id: "company", label: "Company", desc: "Company Admin role" },
                    { id: "agency", label: "Agency", desc: "Agency Admin role" },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-center justify-between rounded-[10px] border px-3 py-2 text-sm ${
                        accountType === opt.id
                          ? "border-amber-400 bg-amber-500/10 text-white"
                          : "border-white/10 bg-white/5 text-white/80"
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-[11px] text-white/60">{opt.desc}</div>
                      </div>
                      <input
                        type="radio"
                        name="accountType"
                        value={opt.id}
                        checked={accountType === (opt.id as any)}
                        onChange={() => setAccountType(opt.id as any)}
                        className="h-4 w-4 accent-amber-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Input
              type="email"
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              leftIcon={<Mail className="h-4 w-4" />}
            />
            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              leftIcon={<Lock className="h-4 w-4" />}
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isLoading}
              rightIcon={!isLoading ? <ArrowRight className="h-4 w-4" /> : undefined}
            >
              {isRegistering ? "Create account" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-4 text-center text-sm">
        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className="font-semibold text-amber-200 transition hover:text-white"
        >
          {isRegistering ? "Already have an account? Sign in" : "Don’t have an account? Create one"}
        </button>
      </div>
    </motion.div>
  );
}
