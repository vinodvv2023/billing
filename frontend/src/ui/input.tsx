"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
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
  const isDateInput = props.type === "date";

  return (
    <label className="block space-y-1.5 text-sm leading-tight">
      {label && <span className="flex items-center gap-1 text-sm font-medium text-white/88">{label}</span>}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/48">
            {leftIcon}
          </span>
        )}
        {isDateInput && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/85">
            <CalendarDays className="h-4 w-4" />
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full rounded-[16px] border border-[var(--border)] bg-white/[0.04] py-3.5 pr-4 text-white placeholder:text-white/32 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none focus:border-amber-400/70 focus:bg-white/[0.06] focus:ring-4 focus:ring-amber-400/12",
            leftIcon ? "pl-11" : "pl-4",
            isDateInput && "pr-11 [color-scheme:dark]",
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
