"use client";

import { useMemo, useState } from "react";
import { AlertCircle, BriefcaseBusiness, Plus } from "lucide-react";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { DataTable } from "@/ui/datatable";
import { Input } from "@/ui/input";
import { Skeleton } from "@/ui/skeleton";
import { useToast } from "@/ui/toast";
import { useClients, useCreateClient, useDeleteClient, useProjects, useUpdateClient } from "@/lib/api-hooks";
import { useTenantScope } from "@/lib/tenant-scope";
import { ClientPortalRedirect } from "@/components/client-portal-redirect";

export default function ClientsPage() {
  const { effectiveRole } = useTenantScope();
  if (effectiveRole === "client") {
    return (
      <ClientPortalRedirect
        title="Redirecting to invoices"
        description="Client records and account management are internal administration tools. Client logins are redirected to the invoice portal."
      />
    );
  }
  return <InternalClientsPage />;
}

function InternalClientsPage() {
  const { activeOrganizationId, activeTenant, effectiveRole } = useTenantScope();
  const clients = useClients(activeOrganizationId);
  const projects = useProjects();
  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();
  const updateClient = useUpdateClient();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", contact_name: "", contact_email: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftStatus, setDraftStatus] = useState("active");
  const [search, setSearch] = useState("");

  const canManage = ["org_admin", "finance", "Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin"].includes(
    effectiveRole
  );
  const isFinanceView = effectiveRole === "finance";

  const clientProjects = useMemo(() => {
    const result = new Map<number, string[]>();
    for (const project of projects.data ?? []) {
      if (project.client_id == null) continue;
      const existing = result.get(project.client_id) ?? [];
      result.set(project.client_id, [...existing, project.name]);
    }
    return result;
  }, [projects.data]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const baseRows = clients.data ?? [];
    if (!query) return baseRows;

    return baseRows.filter((row) => {
      const linkedProjects = clientProjects.get(row.id) ?? [];
      return (
        row.name.toLowerCase().includes(query) ||
        (row.contact_name ?? "").toLowerCase().includes(query) ||
        (row.contact_email ?? "").toLowerCase().includes(query) ||
        row.status.toLowerCase().includes(query) ||
        linkedProjects.some((projectName) => projectName.toLowerCase().includes(query))
      );
    });
  }, [clientProjects, clients.data, search]);

  return (
    <div className="space-y-6">
      {isFinanceView ? (
        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.14),rgba(255,255,255,0.04),rgba(245,158,11,0.06))] p-6">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs uppercase tracking-[0.22em] text-white/42">Billing accounts</p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
              Keep client billing accounts current without drifting into broader admin work.
            </h2>
            <p className="text-sm leading-6 text-white/64 sm:text-[15px]">
              Use this screen to maintain invoice-facing client records, primary contacts, and project linkage for the
              active organization.
            </p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden border-white/12 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,0.04))]">
          <CardHeader>
            <div>
              <CardTitle>{isFinanceView ? "Billing account ledger" : "Client ledger"}</CardTitle>
              <p className="mt-1 text-sm text-white/55">
                {isFinanceView
                  ? "Review invoice-facing client accounts, ownership, and linked project load in one place."
                  : "Keep every billable account in one view with ownership, project load, and status signals attached."}
              </p>
            </div>
            <Badge tone="outline" className="border-white/12 bg-white/[0.04]">
              {activeTenant?.name ?? "Select an organization"}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">Active clients</div>
              <div className="mt-2 text-3xl font-semibold text-white">{rows.filter((item) => item.status === "active").length}</div>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">Project-linked</div>
              <div className="mt-2 text-3xl font-semibold text-white">
                {rows.filter((item) => (clientProjects.get(item.id)?.length ?? 0) > 0).length}
              </div>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">{isFinanceView ? "Primary focus" : "Scope"}</div>
              <div className="mt-2 text-base font-semibold text-white">{isFinanceView ? "Billing readiness" : effectiveRole}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{isFinanceView ? "Add billing account" : "Create client"}</CardTitle>
              <p className="mt-1 text-sm text-white/55">
                {isFinanceView
                  ? "Create a client account that finance can bill and reconcile inside the active organization."
                  : "Add a new billable account to the active organization."}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              label="Client name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Northwind Labs"
              disabled={!activeOrganizationId || !canManage}
            />
            <Input
              label="Primary contact"
              value={form.contact_name}
              onChange={(event) => setForm((current) => ({ ...current, contact_name: event.target.value }))}
              placeholder="Jamie Chen"
              disabled={!activeOrganizationId || !canManage}
            />
            <Input
              label="Contact email"
              type="email"
              value={form.contact_email}
              onChange={(event) => setForm((current) => ({ ...current, contact_email: event.target.value }))}
              placeholder="jamie@northwind.example"
              disabled={!activeOrganizationId || !canManage}
            />
            <Button
              className="w-full"
              disabled={!activeOrganizationId || !canManage || !form.name.trim() || createClient.isPending}
              isLoading={createClient.isPending}
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                if (!activeOrganizationId) return;
                createClient.mutate(
                  {
                    org_id: activeOrganizationId,
                    name: form.name,
                    contact_name: form.contact_name || undefined,
                    contact_email: form.contact_email || undefined,
                    status: "active",
                  },
                  {
                    onSuccess: () => {
                      toast.push({ title: "Client created", variant: "success" });
                      setForm({ name: "", contact_name: "", contact_email: "" });
                    },
                    onError: (error: Error) =>
                      toast.push({
                        title: "Create failed",
                        description: error.message.includes("already exists")
                          ? "A client with this name already exists in this organization. You can add multiple clients, but each client name must be unique within the org."
                          : error.message,
                        variant: "error",
                      }),
                  }
                );
              }}
            >
              {isFinanceView ? "Add billing account" : "Add client"}
            </Button>
            <div className="text-xs text-white/45">
              You can add multiple clients to the same organization. Only duplicate client names in the same organization are blocked.
            </div>
            {!activeOrganizationId && (
              <div className="flex items-start gap-2 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-3 text-xs text-white/60">
                <AlertCircle className="mt-0.5 h-4 w-4 text-amber-300" />
                Select an organization in the header before creating or reviewing clients.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{isFinanceView ? "Billing accounts" : "Account book"}</CardTitle>
              <p className="mt-1 text-sm text-white/50">
                {isFinanceView
                  ? "Client accounts for the selected organization with contact ownership and linked project visibility."
                  : "Clients for the selected organization, with project load and current operating status."}
              </p>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search client, contact, status, or project"
              className="w-full sm:w-80"
            />
          </div>
          {clients.isLoading ? (
            <Badge tone="outline">Syncing</Badge>
          ) : (
            <Badge tone="outline" className="border-white/12 bg-white/[0.04]">
              {rows.length} clients
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {clients.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-14 w-full" />
              ))}
            </div>
          ) : clients.error ? (
            <div className="rounded-[18px] border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-200">
              {String(clients.error.message || "Failed to load clients")}
            </div>
          ) : (
            <DataTable
              data={rows}
              emptyState="No clients in the current organization yet."
              columns={[
                {
                  key: "name",
                  header: "Client",
                  render: (row) =>
                    editingId === row.id ? (
                      <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="h-9" />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-amber-200">
                          <BriefcaseBusiness className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-white">{row.name}</div>
                          <div className="text-xs text-white/45">{row.contact_email || "No contact email"}</div>
                        </div>
                      </div>
                    ),
                },
                {
                  key: "contact_name",
                  header: "Owner",
                  render: (row) => row.contact_name || <span className="text-white/35">Unassigned</span>,
                },
                {
                  key: "projects",
                  header: "Projects",
                  render: (row) => {
                    const linkedProjects = clientProjects.get(row.id) ?? [];
                    if (linkedProjects.length === 0) {
                      return <span className="text-white/35">None linked</span>;
                    }
                    return (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-white">{linkedProjects.length}</div>
                        <div className="text-xs text-white/45">
                          {linkedProjects.slice(0, 3).join(", ")}
                          {linkedProjects.length > 3 ? ` +${linkedProjects.length - 3} more` : ""}
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) =>
                    editingId === row.id ? (
                      <select
                        value={draftStatus}
                        onChange={(event) => setDraftStatus(event.target.value)}
                        className="h-9 rounded-[10px] border border-white/15 bg-[#0b1220] px-2 pr-6 text-xs text-white"
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    ) : (
                      <Badge tone={row.status === "active" ? "success" : "warn"}>{row.status}</Badge>
                    ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  width: "220px",
                  render: (row) =>
                    canManage ? (
                      editingId === row.id ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              updateClient.mutate(
                                { clientId: row.id, orgId: row.org_id, name: draftName, status: draftStatus },
                                {
                                  onSuccess: () => {
                                    toast.push({ title: "Client updated", variant: "success" });
                                    setEditingId(null);
                                  },
                                  onError: (error: Error) =>
                                    toast.push({ title: "Update failed", description: error.message, variant: "error" }),
                                }
                              );
                            }}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(row.id);
                              setDraftName(row.name);
                              setDraftStatus(row.status);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={deleteClient.isPending && pendingDeleteId === row.id}
                            isLoading={deleteClient.isPending && pendingDeleteId === row.id}
                            onClick={() => {
                              setPendingDeleteId(row.id);
                              deleteClient.mutate(
                                { clientId: row.id, orgId: row.org_id },
                                {
                                  onSuccess: () =>
                                    toast.push({ title: "Client deleted", description: `${row.name} removed.`, variant: "success" }),
                                  onError: (error: Error) =>
                                    toast.push({
                                      title: "Delete blocked",
                                      description: error.message.includes("projects reference it")
                                        ? "This client is still linked to one or more projects. Reassign or clear those project client links first."
                                        : error.message,
                                      variant: "error",
                                    }),
                                  onSettled: () => setPendingDeleteId(null),
                                }
                              );
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      )
                    ) : (
                      <span className="text-xs text-white/35">View only</span>
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
