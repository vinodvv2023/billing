"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight } from "lucide-react";
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
  const roleMap: Record<"individual" | "company" | "agency", string> = {
    individual: "Individual User",
    company: "Company Admin",
    agency: "Agency Admin",
  };
  const accountOptions: { id: "individual" | "company" | "agency"; label: string; desc: string }[] = [
    { id: "individual", label: "Individual account", desc: "Create one company, multiple projects" },
    { id: "company", label: "Company", desc: "Company Admin role" },
    { id: "agency", label: "Agency", desc: "Agency Admin role" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
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
      className="w-full"
    >
      <Card className="border-white/10 bg-transparent shadow-none">
        <CardHeader className="items-start text-left">
          <Badge className="mb-3 whitespace-nowrap border-amber-400/30 bg-amber-500/10 text-amber-100" tone="outline">
            Secure access
          </Badge>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-semibold tracking-[-0.04em]">
              {isRegistering ? "Create account" : "Welcome back"}
            </CardTitle>
            <p className="max-w-md text-sm leading-6 text-white/60">
              {isRegistering
                ? "Choose an account model and set your credentials to enter the workspace."
                : "Enter your credentials to continue into the role-based control center."}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Account type</div>
                <div className="grid grid-cols-1 gap-2.5">
                  {accountOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-center justify-between rounded-[18px] border px-4 py-3 text-sm ${
                        accountType === opt.id
                          ? "border-amber-400/50 bg-amber-500/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                          : "border-white/10 bg-white/[0.03] text-white/80"
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-[11px] leading-5 text-white/56">{opt.desc}</div>
                      </div>
                      <input
                        type="radio"
                        name="accountType"
                        value={opt.id}
                        checked={accountType === opt.id}
                        onChange={() => setAccountType(opt.id)}
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
                className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
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
