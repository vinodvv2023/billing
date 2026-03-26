"use client";

import { useState, useMemo } from "react";
import { useAuditLogs } from "@/lib/api-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { DataTable } from "@/ui/datatable";
import { Skeleton } from "@/ui/skeleton";
import { Select } from "@/ui/select";

const actionOptions = [
  { value: "", label: "All actions" },
  { value: "user_deleted", label: "User deleted" },
  { value: "oauth_relinked_user", label: "OAuth relinked" },
  { value: "oauth_account_linked", label: "OAuth account linked" },
  { value: "organization_updated", label: "Org updated" },
  { value: "organization_deleted", label: "Org deleted" },
  { value: "organization_created", label: "Org created" },
  { value: "project_updated", label: "Project updated" },
  { value: "project_deleted", label: "Project deleted" },
  { value: "project_created", label: "Project created" },
  { value: "user_invited", label: "User invited" },
];

export default function AuditPage() {
  const [action, setAction] = useState("");
  const { data, isLoading, error, refetch } = useAuditLogs(action || undefined);
  const rows = data ?? [];
  const isEmpty = !isLoading && !error && rows.length === 0;

  const sortedRows = useMemo(
    () => rows.map((r: any) => ({ ...r, created_at: r.created_at ?? r.createdAt })),
    [rows]
  );

  const formatWhen = (value?: string) => {
    if (!value) return "—";
    const d = new Date(value);
    const rel = (() => {
      const diff = Date.now() - d.getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return "just now";
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d ago`;
      const months = Math.floor(days / 30);
      if (months < 12) return `${months}mo ago`;
      const years = Math.floor(months / 12);
      return `${years}y ago`;
    })();
    const abs = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
    return `${abs} (${rel})`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Audit Trail</h2>
          <p className="text-sm text-white/60">Monitor deletes and OAuth relinks for compliance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              refetch();
            }}
            className="h-11 w-44"
          >
            {actionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Events</CardTitle>
          {error ? <Badge tone="warn">Error</Badge> : <Badge tone="outline">{isLoading ? "Loading" : "Live"}</Badge>}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((k) => (
                <Skeleton key={k} className="h-12 w-full" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {String(error.message || "Failed to load audit logs")}
            </div>
          )}

          {isEmpty && <div className="text-sm text-white/60">No audit events yet.</div>}

          {!isLoading && !error && !isEmpty && (
            <DataTable
              data={sortedRows}
              columns={[
                { key: "action", header: "Action" },
                { key: "provider", header: "Provider" },
                { key: "email", header: "Email" },
                { key: "actor_id", header: "Actor" },
                { key: "target_id", header: "Target" },
                {
                  key: "created_at",
                  header: "When",
                  render: (r: any) => formatWhen(r.created_at),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
