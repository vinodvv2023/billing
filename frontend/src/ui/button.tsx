"use client";

import * as React from "react";
import { cn } from "./utils";

type Variant = "primary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 font-semibold tracking-[-0.01em] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-60";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(135deg,#fbbf24_0%,#f59e0b_52%,#d97706_100%)] text-slate-950 shadow-[0_16px_36px_rgba(245,158,11,0.24)] hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(245,158,11,0.3)]",
  ghost: "bg-transparent text-white/78 hover:bg-white/6 hover:text-white",
  outline:
    "border border-[var(--border-strong)] bg-white/[0.03] text-white/86 hover:border-amber-400/60 hover:bg-amber-500/[0.08] hover:text-white",
  danger: "bg-red-500 text-white shadow-md shadow-red-500/30 hover:bg-red-600",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 rounded-[12px] px-3.5 text-sm",
  md: "h-11 rounded-[14px] px-4.5 text-sm",
  lg: "h-12 rounded-[16px] px-5 text-base",
  icon: "h-10 w-10 rounded-[14px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", isLoading, leftIcon, rightIcon, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(base, variantClass[variant], sizeClass[size], className)}
      {...props}
    >
      {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {!isLoading && leftIcon}
      <span className="whitespace-nowrap">{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
});
