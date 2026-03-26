"use client";

import * as React from "react";
import { cn } from "./utils";

type Variant = "primary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:opacity-60 disabled:cursor-not-allowed";

const variantClass: Record<Variant, string> = {
  primary: "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/30",
  ghost: "bg-transparent hover:bg-white/5 text-amber-100",
  outline:
    "border border-white/15 text-amber-100 hover:border-amber-400 hover:text-white hover:bg-amber-500/5",
  danger: "bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/30",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 rounded-[10px] px-3 text-sm",
  md: "h-11 rounded-[12px] px-4 text-sm",
  lg: "h-12 rounded-[14px] px-5 text-base",
  icon: "h-10 w-10 rounded-[12px]",
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
