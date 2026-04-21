"use client";

import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/ui/button";
import { cn } from "@/ui/utils";

interface OAuthButtonProps {
  provider: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
  isHighlighted?: boolean;
}

export function OAuthButton({ provider, icon, label, onClick, className, isHighlighted }: OAuthButtonProps) {
  return (
    <motion.div whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}>
      <Button
        type="button"
        variant={isHighlighted ? "primary" : "outline"}
        className={cn(
          "h-12 w-full justify-start rounded-[18px] px-4",
          isHighlighted ? "shadow-lg shadow-amber-500/30" : "bg-white/[0.03]",
          className
        )}
        onClick={onClick}
        leftIcon={<span className="flex h-5 w-5 items-center justify-center fill-current">{icon}</span>}
      >
        <span className="flex flex-1 items-center justify-between">
          <span>{label}</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-current/70">{provider}</span>
        </span>
      </Button>
    </motion.div>
  );
}
