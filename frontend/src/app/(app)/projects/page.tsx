"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { DataTable } from "@/ui/datatable";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { useProjects, useOrganizations, useCreateProject, useUpdateProject, useDeleteProject, useClients } from "@/lib/api-hooks";
import type { ClientRecord, OrganizationSummary } from "@/lib/api-hooks";
import { useTenantScope } from "@/lib/tenant-scope";
import { Input } from "@/ui/input";
import { useToast } from "@/ui/toast";
import { useState } from "react";
import { AlertCircle, Link2 } from "lucide-react";
import { ClientPortalRedirect } from "@/components/client-portal-redirect";

const adminRoles = ["Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin", "org_admin"];

export default function ProjectsPage() {
  const { effectiveRole } = useTenantScope();
  if (effectiveRole === "client") {
    return (
      <ClientPortalRedirect
        title="Redirecting to invoices"
        description="Project delivery setup and client linking are internal controls. Client logins are redirected to the invoice portal."
      />
    );
  }
  return <InternalProjectsPage />;
}

function InternalProjectsPage() {
  const { data, isLoading, error } = useProjects();
  const { data: orgs } = useOrganizations();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { effectiveRole, activeOrganizationId } = useTenantScope();
  const [selectedOrgOverride, setSelectedOrgOverride] = useState<number | undefined>(undefined);
  const selectedOrgId = selectedOrgOverride ?? activeOrganizationId ?? undefined;
  const { data: clients } = useClients(selectedOrgId);
  const canEdit = adminRoles.includes(effectiveRole) || effectiveRole === "Individual User";
  const [projName, setProjName] = useState("");
  const [createClientId, setCreateClientId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("Active");
  const [editClientId, setEditClientId] = useState<number | null>(null);
  const toast = useToast();

  const rows = data ?? [];
  const isEmpty = !isLoading && !error && rows.length === 0;
  const resolveClientName = (clientId?: number | null) =>
    clientId == null ? null : clients?.find((client: ClientRecord) => client.id === clientId)?.name ?? `#${clientId}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
        <AlertCircle className="h-5 w-5 text-amber-300 mt-0.5" />
        <div>
          <div className="font-semibold text-white">Role-based limits</div>
          <ul className="mt-1 space-y-1 text-white/70 text-xs">
            <li>Super Admin, Agency Admin, Agency Company Admin, Company Admin, and Individual User can create projects.</li>
            <li>Company/Agency Users: view-only.</li>
            <li>Select an organization first to create a project.</li>
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Projects</h2>
          <p className="text-sm text-white/60">Scope and assign projects per organization.</p>
        </div>
        {canEdit && (
          <form
            className="grid w-full gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-3 lg:grid-cols-[minmax(0,1.1fr)_220px_220px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!projName || !selectedOrgId) return;
              createProject.mutate(
                { name: projName, org_id: selectedOrgId, client_id: createClientId, status: "Active" },
                {
                  onSuccess: () => {
                    toast.push({ title: "Project created", variant: "success" });
                    setProjName("");
                    setCreateClientId(null);
                  },
                  onError: (err: Error) =>
                    toast.push({ title: "Create failed", description: String(err?.message ?? err), variant: "error" }),
                }
              );
            }}
          >
            <Input
              placeholder="Project name"
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              className="w-full"
            />
            <select
              value={selectedOrgId ?? ""}
              onChange={(e) => {
                setSelectedOrgOverride(Number(e.target.value) || undefined);
                setCreateClientId(null);
              }}
              className="h-11 rounded-[12px] border border-white/15 bg-[#0b1220] px-3 pr-8 text-sm text-white focus:border-amber-400 focus:outline-none appearance-none"
            >
              <option value="">Select org</option>
              {(orgs ?? []).map((o: OrganizationSummary) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <select
              value={createClientId ?? ""}
              onChange={(e) => setCreateClientId(Number(e.target.value) || null)}
              disabled={!selectedOrgId}
              className="h-11 rounded-[12px] border border-white/15 bg-[#0b1220] px-3 pr-8 text-sm text-white focus:border-amber-400 focus:outline-none appearance-none disabled:opacity-50"
            >
              <option value="">No client linked</option>
              {(clients ?? []).map((client: ClientRecord) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            <Button size="sm" type="submit" disabled={createProject.isPending || !selectedOrgId}>New project</Button>
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
              {String(error.message || "Failed to load projects")}
            </div>
          )}

          {isEmpty && <div className="text-sm text-white/60">No projects yet. Create one to get started.</div>}

          {!isLoading && !error && !isEmpty && (
            <DataTable
              data={rows}
              columns={[
                {
                  key: "name",
                  header: "Project",
                  render: (r) =>
                    editingId === r.id ? (
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9" />
                    ) : (
                      r.name
                    ),
                },
                { key: "org", header: "Organization" },
                {
                  key: "client_id",
                  header: "Client",
                  render: (r) =>
                    editingId === r.id ? (
                      <select
                        value={editClientId ?? ""}
                        onChange={(e) => setEditClientId(Number(e.target.value) || null)}
                        className="h-9 min-w-[180px] rounded-[10px] border border-white/15 bg-[#0b1220] px-2 pr-6 text-xs text-white"
                      >
                        <option value="">No client linked</option>
                        {(clients ?? []).map((client: ClientRecord) => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </select>
                    ) : r.client_id ? (
                      <div className="inline-flex items-center gap-2 text-sm text-white/80">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] p-1 text-amber-200">
                          <Link2 className="h-3.5 w-3.5" />
                        </span>
                        <span>{resolveClientName(r.client_id)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-white/40">Unlinked</span>
                    ),
                },
                { key: "created_by_email", header: "Owner" },
                { key: "members", header: "Members" },
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
                    canEdit ? (
                      <div className="flex gap-2">
                        {editingId === r.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                updateProject.mutate(
                                  { id: r.id, name: editName || r.name, status: editStatus || r.status, client_id: editClientId },
                                  {
                                    onSuccess: () => toast.push({ title: "Project updated", variant: "success" }),
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
                                setEditClientId(r.client_id ?? null);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={pendingDelete === r.id || deleteProject.isPending}
                              isLoading={pendingDelete === r.id && deleteProject.isPending}
                              onClick={() => {
                                setPendingDelete(r.id);
                                deleteProject.mutate(
                                  { id: r.id },
                                  {
                                    onSuccess: () => toast.push({ title: "Project deleted", variant: "success" }),
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
