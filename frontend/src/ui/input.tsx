"use client";

import * as React from "react";
import { cn } from "./utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, leftIcon, ...props },
  ref
) {
  return (
    <label className="block space-y-1.5 text-sm leading-tight">
      {label && <span className="text-amber-50/90 flex items-center gap-1">{label}</span>}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full rounded-[12px] border border-white/10 bg-white/5 py-3 pr-4 text-amber-50 placeholder:text-white/40 shadow-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60 outline-none transition-all",
            leftIcon ? "pl-11" : "pl-4",
            error && "border-red-500/60 focus:ring-red-500/50",
            className
          )}
          {...props}
        />
      </div>
      {(hint || error) && (
        <span className={cn("text-xs", error ? "text-red-400" : "text-white/60")}>{error || hint}</span>
      )}
    </label>
  );
});
