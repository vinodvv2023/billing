"use client";

import { useMemo, useState } from "react";
import { useTenantSummary, useAssignProject, useUnassignProject } from "@/lib/api-hooks";
import type { TenantMember, TenantProject, TenantSummary } from "@/lib/api-hooks";
import { useTenantScope } from "@/lib/tenant-scope";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { Combobox } from "@/ui/combobox";
import { useToast } from "@/ui/toast";

const adminAssignable: Record<string, string[]> = {
  "Super Admin": ["Super Admin", "Agency Admin", "Agency Company Admin", "Agency User", "Company Admin", "Company User"],
  "Agency Admin": ["Agency Company Admin", "Agency User"],
  "Agency Company Admin": ["Agency User"],
  "Company Admin": ["Company User"],
};

export function AssignmentsPage() {
  const { data, isLoading, error } = useTenantSummary();
  const assignProject = useAssignProject();
  const unassignProject = useUnassignProject();
  const { effectiveRole, activeOrganizationId } = useTenantScope();
  const { roles } = useSession();
  const toast = useToast();
  const globalAdminRole = roles.find((role) => Object.keys(adminAssignable).includes(role)) ?? null;
  const myRole = adminAssignable[effectiveRole] ? effectiveRole : (globalAdminRole ?? effectiveRole ?? "user");
  const [selectedUser, setSelectedUser] = useState<Record<number, number>>({});
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const allowedRoles = useMemo(() => adminAssignable[myRole] ?? [], [myRole]);
  const getAssignableMembers = (members: TenantMember[], projectMembers: TenantMember[]) => {
    const assignedIds = new Set(projectMembers.map((member) => member.user_id));
    return members.filter((member) => {
      if (!allowedRoles.includes(member.role)) return false;
      return !assignedIds.has(member.user_id);
    });
  };
  const canManageMember = (member: TenantMember) => allowedRoles.includes(member.role);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Assignments</h2>
          <p className="text-sm text-white/60">Assign members to projects inside their organizations.</p>
        </div>
        {error ? <Badge tone="warn">Error</Badge> : <Badge tone="outline">{isLoading ? "Loading" : "Live"}</Badge>}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((k) => (
            <Skeleton key={k} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {String(error.message || "Failed to load assignments")}
        </div>
      )}

      {!isLoading && !error && (data ?? [])
        .filter((org: TenantSummary) => activeOrganizationId == null || org.id === activeOrganizationId)
        .map((org: TenantSummary) => (
          <Card key={org.id} className="border-white/10 bg-white/5">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{org.name}</CardTitle>
              <Badge tone="outline">Members: {org.members.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-xs text-white/60">Members</div>
              <div className="flex flex-wrap gap-2">
                {org.members.map((member) => (
                  <Badge key={member.user_id} tone="outline" className="gap-1">
                    {member.email}
                    <span className="text-[10px] uppercase tracking-wide text-white/70">{member.role}</span>
                  </Badge>
                ))}
              </div>

              <div className="space-y-3">
                {org.projects.map((project: TenantProject) => {
                  const assignableMembers = getAssignableMembers(org.members, project.members);
                  const assignableOptions = assignableMembers.map((member) => ({
                    label: `${member.email} (${member.role})`,
                    value: String(member.user_id),
                  }));

                  return (
                    <div key={project.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">{project.name}</div>
                          <div className="text-xs text-white/50">Members: {project.members.length}</div>
                        </div>
                        <div className="flex items-end gap-2">
                          <Combobox
                            label="Select member"
                            value={selectedUser[project.id] != null ? String(selectedUser[project.id]) : ""}
                            options={assignableOptions}
                            placeholder="Select member"
                            searchPlaceholder="Search user"
                            emptyText="No eligible members found"
                            className="w-80"
                            onChange={(nextValue) =>
                              setSelectedUser((prev) => ({ ...prev, [project.id]: Number(nextValue) || 0 }))
                            }
                          />
                          <Button
                            size="sm"
                            disabled={!selectedUser[project.id] || assignProject.isPending}
                            isLoading={assignProject.isPending && !!selectedUser[project.id]}
                            onClick={() => {
                              const uid = selectedUser[project.id];
                              if (!uid) return;
                              assignProject.mutate(
                                { projectId: project.id, userId: uid },
                                {
                                  onSuccess: () => toast.push({ title: "Member assigned", variant: "success" }),
                                  onError: (err: Error) =>
                                    toast.push({ title: "Assign failed", description: String(err?.message ?? err), variant: "error" }),
                                }
                              );
                            }}
                          >
                            Assign
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {project.members.map((member) => (
                          <div key={member.user_id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                            <div className="flex items-center gap-1 text-xs text-white">
                              <span>{member.email}</span>
                              <span className="text-[10px] uppercase tracking-wide text-white/70">{member.role}</span>
                            </div>
                            {canManageMember(member) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                disabled={unassignProject.isPending}
                                isLoading={unassignProject.isPending && pendingRemoval === `${project.id}:${member.user_id}`}
                                onClick={() => {
                                  const removalKey = `${project.id}:${member.user_id}`;
                                  setPendingRemoval(removalKey);
                                  unassignProject.mutate(
                                    { projectId: project.id, userId: member.user_id },
                                    {
                                      onSuccess: () => toast.push({ title: "Member removed", variant: "success" }),
                                      onError: (err: Error) =>
                                        toast.push({ title: "Remove failed", description: String(err?.message ?? err), variant: "error" }),
                                      onSettled: () => setPendingRemoval(null),
                                    }
                                  );
                                }}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      {assignableMembers.length === 0 && (
                        <div className="mt-3 text-xs text-white/45">No eligible tenant members available for assignment.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
