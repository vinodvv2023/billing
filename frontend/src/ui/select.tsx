"use client";

import * as React from "react";
import { cn } from "./utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-11 rounded-[12px] border border-white/15 bg-[#0b1220] px-3 pr-8 text-sm text-white focus:border-amber-400 focus:outline-none appearance-none",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
