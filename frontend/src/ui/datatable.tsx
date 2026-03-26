"use client";

import * as React from "react";
import { cn } from "./utils";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({ data, columns, emptyState, className }: DataTableProps<T>) {
  return (
    <div className={cn("overflow-hidden rounded-[14px] border border-white/10 bg-white/5", className)}>
      <table className="min-w-full border-collapse text-sm text-white/80">
        <thead className="bg-white/5 text-white/70">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key as string}
                className="px-4 py-3 text-left font-semibold"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-white/50">
                {emptyState ?? "No records yet."}
              </td>
            </tr>
          )}
          {data.map((item, idx) => (
            <tr key={idx} className="border-t border-white/5 hover:bg-white/[0.03]">
              {columns.map((col) => (
                <td key={col.key as string} className="px-4 py-3">
                  {col.render ? col.render(item) : String((item as any)[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
