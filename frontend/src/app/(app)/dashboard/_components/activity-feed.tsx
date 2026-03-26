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
  const entries = activity.data ?? [];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Recent activity</CardTitle>
        <Badge tone="outline">Live</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {activity.isLoading ? (
          <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-6 text-sm text-white/60">Loading activity...</div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-6 text-sm text-white/60">No recent activity in your current scope.</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
              <div>
                <div className="text-sm text-white/90">
                  <span className="font-semibold">{entry.actor_email ?? "System"}</span>{" "}
                  {formatAction(entry.action)}{" "}
                  <span className="font-semibold">{formatTarget(entry.target_type, entry.email)}</span>
                </div>
                <div className="text-xs text-white/50">{formatRelativeTime(entry.created_at)}</div>
              </div>
              <Badge tone="outline">{formatAction(entry.action)}</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
