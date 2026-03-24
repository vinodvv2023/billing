"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";

interface LoginFormProps {
  onLogin: (e: string, p: string) => Promise<void>;
  onRegister: (e: string, p: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export function LoginForm({ onLogin, onRegister, isLoading, error }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
      await onRegister(email, password);
    } else {
      await onLogin(email, password);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
          {isRegistering ? "Create Account" : "Welcome Back"}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          {isRegistering ? "Sign up to get started" : "Enter your credentials to access your account"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-300 ml-1">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-white placeholder-zinc-500 outline-none transition focus:border-cyan-400/50 focus:bg-white/10 focus:ring-1 focus:ring-cyan-400/50"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-300 ml-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-white placeholder-zinc-500 outline-none transition focus:border-cyan-400/50 focus:bg-white/10 focus:ring-1 focus:ring-cyan-400/50"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: "auto" }}
            className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20"
          >
            {error}
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={isLoading}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 px-4 text-sm font-semibold text-white shadow-[0_0_20px_rgb(6,182,212,0.3)] transition-all hover:shadow-[0_0_30px_rgb(6,182,212,0.5)] disabled:opacity-70"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {isRegistering ? "Sign Up" : "Sign In"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </motion.button>
      </form>

      <div className="mt-6 text-center text-sm">
        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className="font-medium text-cyan-400 transition-colors hover:text-cyan-300"
        >
          {isRegistering ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
        </button>
      </div>
    </motion.div>
  );
}
