"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { useOrganizations, useProjects, useUsers } from "@/lib/api-hooks";
import { useTenantScope } from "@/lib/tenant-scope";

export function RoleMatrixMini() {
  const { activeOrganizationId, effectiveRole } = useTenantScope();
  const organizations = useOrganizations();
  const projects = useProjects();
  const users = useUsers(activeOrganizationId);

  const activeOrganization = (organizations.data ?? []).find((organization) => organization.id === activeOrganizationId) ?? null;
  const activeProjects = (projects.data ?? []).filter((project) => activeOrganization == null || project.org === activeOrganization.name);
  const activeUsers = users.data ?? [];
  const pendingUsers = activeUsers.filter((user) => user.status === "Pending").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-3">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Active organization</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">{activeOrganization?.name ?? "No organization selected"}</div>
              <div className="text-xs text-white/60">{activeOrganization?.type ?? "Select a workspace to scope data"}</div>
            </div>
            <Badge tone="default">{effectiveRole}</Badge>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">Visible projects</div>
            <div className="mt-2 text-2xl font-semibold text-white">{activeProjects.length}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">Visible users</div>
            <div className="mt-2 text-2xl font-semibold text-white">{activeUsers.length}</div>
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Pending invites</div>
              <div className="text-xs text-white/60">Users still waiting to activate</div>
            </div>
            <Badge tone={pendingUsers > 0 ? "warn" : "success"}>{pendingUsers}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
