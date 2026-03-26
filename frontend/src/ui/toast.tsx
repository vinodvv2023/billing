"use client";

import * as React from "react";
import { cn } from "./utils";
import { X } from "lucide-react";

type ToastVariant = "default" | "success" | "error";

type Toast = {
  id: number;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextType = {
  push: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = React.createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    const duration = toast.duration ?? 3200;
    setToasts((prev) => [...prev, { ...toast, id, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "w-80 rounded-[14px] border p-4 shadow-lg backdrop-blur bg-[var(--surface-elevated)]",
              toast.variant === "success" && "border-green-400/40 text-green-100",
              toast.variant === "error" && "border-red-400/40 text-red-100",
              (!toast.variant || toast.variant === "default") && "border-white/15 text-white"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-sm font-semibold">{toast.title}</div>
                {toast.description && <p className="mt-1 text-xs text-white/70">{toast.description}</p>}
              </div>
              <button
                className="rounded-full p-1 text-white/70 hover:text-white hover:bg-white/10 transition"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
