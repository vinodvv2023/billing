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
          "w-full justify-center",
          isHighlighted ? "shadow-lg shadow-amber-500/40" : "bg-white/5",
          className
        )}
        onClick={onClick}
        leftIcon={<span className="h-5 w-5 fill-current">{icon}</span>}
      >
        {label}
      </Button>
    </motion.div>
  );
}
