"use client";

import * as React from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "./utils";

type ComboboxOption = {
  label: string;
  value: string;
};

type ComboboxProps = {
  label?: string;
  options: ComboboxOption[];
  value: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  onChange: (value: string) => void;
};

export function Combobox({
  label,
  options,
  value,
  placeholder = "Select option",
  searchPlaceholder = "Search",
  emptyText = "No results found",
  className,
  onChange,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listboxId = React.useId();

  const selectedOption = options.find((option) => option.value === value) ?? null;
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {label && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{label}</div>}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={label ?? placeholder}
        className="flex h-11 min-w-64 items-center justify-between gap-3 rounded-[12px] border border-white/15 bg-[#0b1220] px-3 text-sm text-white transition hover:border-white/25 focus:outline-none focus:border-amber-400"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn("truncate", !selectedOption && "text-white/45")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-white/55 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-full rounded-[16px] border border-white/10 bg-[#08101b] p-2 shadow-2xl shadow-black/40">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-[10px] border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div id={listboxId} role="listbox" className="mt-2 max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="rounded-[10px] px-3 py-2 text-sm text-white/45">{emptyText}</div>
            ) : (
              filteredOptions.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm transition",
                      active ? "bg-amber-500/15 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"
                    )}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="truncate">{option.label}</span>
                    {active && <Check className="h-4 w-4 text-amber-300" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
