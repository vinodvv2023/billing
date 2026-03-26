import * as React from "react";
import { cn } from "./utils";

type Tone = "default" | "success" | "warn" | "outline";

const toneClass: Record<Tone, string> = {
  default: "bg-amber-500/15 text-amber-200 border border-amber-500/30",
  success: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30",
  warn: "bg-red-500/15 text-red-200 border border-red-500/30",
  outline: "border border-white/15 text-white/80",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold tracking-tight",
        toneClass[tone],
        className
      )}
      {...props}
    />
  );
}
