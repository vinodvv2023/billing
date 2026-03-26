"use client";

import * as React from "react";
import { cn } from "./utils";

interface Tab {
  value: string;
  label: string;
  badge?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div className={cn("inline-flex rounded-[12px] border border-white/10 bg-white/5 p-1", className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative min-w-[110px] rounded-[10px] px-4 py-2 text-sm font-semibold transition-all",
              active
                ? "bg-amber-500 text-slate-950 shadow-[0_10px_30px_rgba(245,158,11,0.35)]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            )}
          >
            <span className="inline-flex items-center gap-2">
              {tab.label}
              {tab.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}
