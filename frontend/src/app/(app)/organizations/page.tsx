"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { DataTable } from "@/ui/datatable";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { useOrganizations, useCreateOrganization, useUpdateOrganization, useDeleteOrganization } from "@/lib/api-hooks";
import { useTenantScope } from "@/lib/tenant-scope";
import { Input } from "@/ui/input";
import { useToast } from "@/ui/toast";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { ClientPortalRedirect } from "@/components/client-portal-redirect";

const orgCreateRoles = ["Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin"];
const orgManageRoles = ["Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin", "org_admin"];

export default function OrganizationsPage() {
  const { effectiveRole } = useTenantScope();
  if (effectiveRole === "client") {
    return (
      <ClientPortalRedirect
        title="Redirecting to invoices"
        description="Organization setup and tenant management are internal administration functions. Client logins are redirected to the invoice portal."
      />
    );
  }
  return <InternalOrganizationsPage />;
}

function InternalOrganizationsPage() {
  const { data, isLoading, error } = useOrganizations();
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();
  const { effectiveRole } = useTenantScope();
  const canCreate = orgCreateRoles.includes(effectiveRole);
  const canManage = orgManageRoles.includes(effectiveRole);
  const role = effectiveRole || "user";
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("Company");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("Company");
  const [editStatus, setEditStatus] = useState("Active");
  const toast = useToast();

  const rows = data ?? [];
  const isEmpty = !isLoading && !error && rows.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
        <AlertCircle className="h-5 w-5 text-amber-300 mt-0.5" />
        <div>
          <div className="font-semibold text-white">Role-based limits</div>
          <ul className="mt-1 space-y-1 text-white/70 text-xs">
            <li>Super/Agency Admin, Agency Company Admin: can create Agency or Company orgs.</li>
            <li>Company Admin & Individual User: can create only one Company org.</li>
            <li>Company/Agency Users: view-only here.</li>
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Organizations</h2>
          <p className="text-sm text-white/60">Companies and agencies with scoped access.</p>
        </div>
        {canCreate && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!orgName) return;
              createOrg.mutate({ name: orgName, type: orgType });
              setOrgName("");
            }}
          >
            <Input
              placeholder="Org name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-48"
              disabled={!canCreate}
            />
            <select
              value={orgType}
              onChange={(e) => setOrgType(e.target.value)}
              className="h-11 rounded-[12px] border border-white/15 bg-[#0b1220] px-3 pr-8 text-sm text-white focus:border-amber-400 focus:outline-none appearance-none"
              disabled={!canCreate}
            >
              {(role === "Super Admin" || role === "Agency Admin" || role === "Agency Company Admin") && (
                <>
                  <option value="Company">Company</option>
                  <option value="Agency">Agency</option>
                </>
              )}
              {role === "Company Admin" && <option value="Company">Company</option>}
            </select>
            <Button size="sm" type="submit" disabled={!canCreate || createOrg.isPending}>New organization</Button>
          </form>
        )}
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Overview</CardTitle>
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
              {String(error.message || "Failed to load organizations")}
            </div>
          )}

          {isEmpty && <div className="text-sm text-white/60">No organizations yet. Create one to get started.</div>}

          {!isLoading && !error && !isEmpty && (
            <DataTable
              data={rows}
              columns={[
                {
                  key: "name",
                  header: "Name",
                  render: (r) =>
                    editingId === r.id ? (
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9" />
                    ) : (
                      r.name
                    ),
                },
                {
                  key: "type",
                  header: "Type",
                  render: (r) =>
                    editingId === r.id ? (
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="h-9 rounded-[10px] border border-white/15 bg-[#0b1220] px-2 pr-6 text-xs text-white"
                      >
                        <option value="Company">Company</option>
                        <option value="Agency">Agency</option>
                      </select>
                    ) : (
                      r.type
                    ),
                },
                { key: "projects", header: "Projects" },
                { key: "members", header: "Members" },
                {
                  key: "created_by_email",
                  header: "Owner",
                  render: (r) => (
                    <div className="text-xs text-white/80">
                      {r.created_by_email || "Unknown"}
                      <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                        Creator
                      </span>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    editingId === r.id ? (
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="h-9 rounded-[10px] border border-white/15 bg-[#0b1220] px-2 pr-6 text-xs text-white"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    ) : (
                      <Badge tone={String(r.status).toLowerCase() === "active" ? "success" : "warn"}>
                        {r.status}
                      </Badge>
                    )
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  width: "140px",
            render: (r) =>
                    canManage ? (
                      <div className="flex gap-2">
                        {editingId === r.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                updateOrg.mutate(
                                  { id: r.id, name: editName || r.name, type: editType || r.type, status: editStatus || r.status },
                                  {
                                    onSuccess: () => toast.push({ title: "Organization updated", variant: "success" }),
                                    onError: (err: Error) =>
                                      toast.push({ title: "Update failed", description: String(err?.message ?? err), variant: "error" }),
                                    onSettled: () => setEditingId(null),
                                  }
                                );
                              }}
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(r.id);
                                setEditName(r.name);
                                setEditStatus(r.status);
                                setEditType(r.type);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={pendingDelete === r.id || deleteOrg.isPending}
                              isLoading={pendingDelete === r.id && deleteOrg.isPending}
                              onClick={() => {
                                setPendingDelete(r.id);
                                deleteOrg.mutate(
                                  { id: r.id },
                                  {
                                    onSuccess: () => toast.push({ title: "Organization deleted", variant: "success" }),
                                    onError: (err: Error) =>
                                      toast.push({ title: "Delete failed", description: String(err?.message ?? err), variant: "error" }),
                                    onSettled: () => setPendingDelete(null),
                                  }
                                );
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
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
