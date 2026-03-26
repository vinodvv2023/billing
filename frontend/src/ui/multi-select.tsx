"use client";

import * as React from "react";
import { cn } from "./utils";

export type MultiSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const MultiSelect = React.forwardRef<HTMLSelectElement, MultiSelectProps>(function MultiSelect(
  { className, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      multiple
      className={cn(
        "min-h-28 rounded-[12px] border border-white/15 bg-[#0b1220] px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
