"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { useOrganizations, useProjects, useUsers } from "@/lib/api-hooks";

export function SummaryCards() {
  const organizations = useOrganizations();
  const projects = useProjects();
  const users = useUsers();

  const organizationCount = (organizations.data ?? []).filter((item) => item.status === "Active").length;
  const projectCount = (projects.data ?? []).filter((item) => item.status === "Active").length;
  const activeUserCount = (users.data ?? []).filter((item) => item.status === "Active").length;
  const pendingInviteCount = (users.data ?? []).filter((item) => item.status === "Pending").length;

  const summary = [
    { label: "Active organizations", value: organizationCount, badge: organizationCount === 1 ? "1 workspace" : `${organizationCount} workspaces` },
    { label: "Projects live", value: projectCount, badge: projectCount === 1 ? "1 project" : `${projectCount} projects` },
    { label: "Active users", value: activeUserCount, badge: activeUserCount === 1 ? "1 member" : `${activeUserCount} members` },
    { label: "Invites pending", value: pendingInviteCount, badge: pendingInviteCount > 0 ? "Action needed" : "Up to date" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summary.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <CardTitle className="text-sm text-white/60">{item.label}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold text-white">
              {organizations.isLoading || projects.isLoading || users.isLoading ? "..." : item.value}
            </div>
            <Badge tone="outline">{item.badge}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
