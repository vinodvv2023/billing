"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { useDashboardActivity } from "@/lib/api-hooks";

function formatAction(action: string) {
  return action.replaceAll("_", " ");
}

function formatTarget(targetType: string, email?: string | null) {
  if (email) return email;
  return targetType;
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const diffInMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.round(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.round(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export function ActivityFeed() {
  const activity = useDashboardActivity();
  const entries = (activity.data ?? []).filter((entry) =>
    ["client_", "timesheet_", "invoice_", "billing_rate_"].some((prefix) => entry.action.startsWith(prefix))
  );

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Revenue activity</CardTitle>
          <p className="mt-1 text-sm text-white/50">A live stream of client, timesheet, and invoice events in your current scope.</p>
        </div>
        <Badge tone="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-100">Live</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {activity.isLoading ? (
          <div className="rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-6 text-sm text-white/60">Loading activity...</div>
        ) : entries.length === 0 ? (
          <div className="rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-6 text-sm text-white/60">No recent activity in your current scope.</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-[20px] border border-white/8 bg-white/[0.035] px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-sm leading-6 text-white/90">
                    <span className="font-semibold text-white">{entry.actor_email ?? "System"}</span>{" "}
                    {formatAction(entry.action)}{" "}
                    <span className="font-semibold text-white">{formatTarget(entry.target_type, entry.email)}</span>
                  </div>
                  <div className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-white/42">
                    {formatRelativeTime(entry.created_at)}
                  </div>
                </div>
              </div>
              <div className="sm:pt-0.5">
                <Badge tone="outline" className="border-white/12 bg-white/[0.03]">
                  {formatAction(entry.action)}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
