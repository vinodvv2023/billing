"use client";

import React from "react";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface OAuthButtonProps {
  provider: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}

export function OAuthButton({ provider, icon, label, onClick, className }: OAuthButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-4 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
        "text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/20 hover:shadow-[0_8px_30px_rgb(255,255,255,0.1)]",
        className
      )}
    >
      <span className="h-5 w-5 fill-current">{icon}</span>
      <span>{label}</span>
    </motion.button>
  );
}
