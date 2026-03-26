"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { DataTable } from "@/ui/datatable";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { useUsers, useInviteUser, useUpdateUserRole, useDeleteUser, useOrganizations } from "@/lib/api-hooks";
import type { OrganizationSummary, UserSummary } from "@/lib/api-hooks";
import { useSession } from "@/lib/session";
import { useTenantScope } from "@/lib/tenant-scope";
import { Input } from "@/ui/input";
import { MultiSelect } from "@/ui/multi-select";
import { useToast } from "@/ui/toast";
import { useState } from "react";

const adminRoles = ["Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin"];
const roleOptionsByAdmin: Record<string, string[]> = {
  "Super Admin": ["Super Admin", "Agency Admin", "Agency Company Admin", "Agency User", "Company Admin", "Company User", "Individual User"],
  "Agency Admin": ["Agency Company Admin", "Agency User"],
  "Agency Company Admin": ["Agency User"],
  "Company Admin": ["Company User"],
};

export default function UsersPage() {
  const { effectiveRole, activeOrganizationId } = useTenantScope();
  const { data, isLoading, error } = useUsers(activeOrganizationId);
  const { data: organizations } = useOrganizations();
  const invite = useInviteUser();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();
  const { userId, roles } = useSession();
  const globalAdminRole = roles.find((role) => adminRoles.includes(role)) ?? null;
  const canEdit = adminRoles.includes(effectiveRole) || Boolean(globalAdminRole);
  const primaryRole = adminRoles.includes(effectiveRole) ? effectiveRole : (globalAdminRole ?? effectiveRole ?? "user");
  const allowedRoleOptions = roleOptionsByAdmin[primaryRole] ?? [];
  const canManageRole = (role: string) => allowedRoleOptions.includes(role);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [selectedOrgIds, setSelectedOrgIds] = useState<number[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [directorySearch, setDirectorySearch] = useState("");
  const toast = useToast();

  const rows = (data ?? []).filter((user) => {
    const query = directorySearch.trim().toLowerCase();
    if (!query) return true;
    return (
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query) ||
      user.status.toLowerCase().includes(query)
    );
  });
  const isEmpty = !isLoading && !error && rows.length === 0;
  const inviteOrganizations = activeOrganizationId
    ? (organizations ?? []).filter((organization) => organization.id === activeOrganizationId)
    : (organizations ?? []);
  const visibleOrganizationIds = activeOrganizationId ? [activeOrganizationId] : inviteOrganizations.map((org) => org.id);
  const selectedInviteRole =
    allowedRoleOptions.includes(inviteRole) ? inviteRole : (allowedRoleOptions[0] ?? "");
  const effectiveOrgIds = selectedOrgIds.length > 0 ? selectedOrgIds : inviteOrganizations.length === 1 ? [inviteOrganizations[0].id] : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Users</h2>
        <p className="text-sm text-white/60">Invite users and manage access.</p>
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Invite User</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_220px_auto] lg:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (!inviteEmail || !selectedInviteRole) return;
                if (inviteOrganizations.length > 0 && effectiveOrgIds.length === 0) {
                  toast.push({
                    title: "Select organization",
                    description: "Choose at least one organization for this invite.",
                    variant: "error",
                  });
                  return;
                }
                invite.mutate(
                  { email: inviteEmail, role: selectedInviteRole, organization_ids: effectiveOrgIds },
                  {
                    onSuccess: (result: UserSummary) => {
                      if (result?.invite_link) {
                        navigator.clipboard.writeText(result.invite_link).catch(() => undefined);
                        toast.push({
                          title: "Invite link copied",
                          description: `Invitation created for ${result.email}.`,
                          variant: "success",
                        });
                      } else {
                        toast.push({
                          title: "User invited",
                          description: `Invitation created for ${result.email}.`,
                          variant: "success",
                        });
                      }
                    },
                    onError: (err: Error) =>
                      toast.push({
                        title: "Invite failed",
                        description: String(err?.message ?? "Unable to create invite"),
                        variant: "error",
                      }),
                  }
                );
                setInviteEmail("");
                setSelectedOrgIds([]);
              }}
            >
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/45">Email</span>
                <Input
                  placeholder="email@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/45">Role</span>
                <select
                  value={selectedInviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="h-11 w-full rounded-[12px] border border-white/15 bg-[#0b1220] px-3 pr-8 text-sm text-white focus:border-amber-400 focus:outline-none appearance-none"
                >
                  {allowedRoleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </label>

              <Button size="sm" type="submit" disabled={invite.isPending} className="lg:self-end">
                Invite
              </Button>

              {inviteOrganizations.length > 0 && (
                <div className="space-y-2 lg:col-span-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Organizations</div>
                  <MultiSelect
                    value={effectiveOrgIds.map(String)}
                    onChange={(e) =>
                      setSelectedOrgIds(Array.from(e.target.selectedOptions, (option) => Number(option.value)))
                    }
                    className="w-full"
                  >
                    {inviteOrganizations.map((org: OrganizationSummary) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </MultiSelect>
                  <p className="text-xs text-white/45">Hold Ctrl or Cmd to select multiple organizations.</p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Directory</CardTitle>
            <Input
              value={directorySearch}
              onChange={(event) => setDirectorySearch(event.target.value)}
              placeholder="Search user, role, or status"
              className="w-72"
            />
          </div>
          {error ? <Badge tone="warn">Error</Badge> : <Badge tone="outline">{isLoading ? "Loading" : `${rows.length} shown`}</Badge>}
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
              {String(error.message || "Failed to load users")}
            </div>
          )}

          {isEmpty && <div className="text-sm text-white/60">No users yet. Invite someone to collaborate.</div>}

          {!isLoading && !error && !isEmpty && (
            <DataTable
              data={rows}
              columns={[
                { key: "email", header: "Email" },
                {
                  key: "role",
                  header: "Role",
                  render: (r) => (
                    <select
                      defaultValue={r.role}
                      disabled={!canEdit || !canManageRole(r.role)}
                      onChange={(e) =>
                        updateRole.mutate({ userId: r.id, role: e.target.value, organization_ids: visibleOrganizationIds })
                      }
                      className="h-9 rounded-[10px] border border-white/15 bg-[#0b1220] px-2 pr-8 text-xs text-white focus:border-amber-400 focus:outline-none appearance-none"
                    >
                      {canManageRole(r.role) ? (
                        allowedRoleOptions.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))
                      ) : (
                        <option value={r.role}>{r.role}</option>
                      )}
                    </select>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <Badge tone={String(r.status).toLowerCase() === "active" ? "success" : "warn"}>
                      {r.status}
                    </Badge>
                  ),
                },
                {
                  key: "invite_link",
                  header: "Invite",
                  render: (r) =>
                    r.status === "Pending" && r.invite_link ? (
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const inviteLink = r.invite_link;
                            if (!inviteLink) return;
                            navigator.clipboard.writeText(inviteLink);
                            toast.push({ title: "Copied invite link", variant: "success" });
                          }}
                        >
                          Copy link
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toast.push({ title: "Email invite", description: "Email sending not wired yet.", variant: "default" })}
                        >
                          Send email invite
                        </Button>
                        {r.invite_expires_at && (
                          <span className="text-[11px] text-white/50">Expires: {new Date(r.invite_expires_at).toLocaleString()}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-white/40">—</span>
                    ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  width: "120px",
                  render: (r) =>
                    canEdit ? (
                      <Button
                        size="sm"
                        variant="danger"
                        aria-label={`Delete ${r.email}`}
                        disabled={
                          deleteUser.isPending && pendingDeleteId === r.id || r.id === userId
                        }
                        isLoading={deleteUser.isPending && pendingDeleteId === r.id}
                        onClick={() => {
                          setPendingDeleteId(r.id);
                          deleteUser.mutate(
                            { userId: r.id },
                            {
                              onSuccess: () =>
                                toast.push({
                                  title: "User deleted",
                                  description: `${r.email} removed.`,
                                  variant: "success",
                                }),
                              onError: (err: Error) =>
                                toast.push({
                                  title: "Delete failed",
                                  description: String(err?.message ?? "Unable to delete user"),
                                  variant: "error",
                                }),
                              onSettled: () => setPendingDeleteId(null),
                            }
                          );
                        }}
                        className="w-full"
                      >
                        {r.id === userId ? "You" : "Delete"}
                      </Button>
                    ) : (
                      <span className="text-xs text-white/40">—</span>
                    ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
