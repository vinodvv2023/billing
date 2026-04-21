"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { useClients, useInvoices, useProjects, useUnbilledSummary } from "@/lib/api-hooks";
import { useTenantScope } from "@/lib/tenant-scope";

export function RoleMatrixMini() {
  const { activeOrganizationId, effectiveRole } = useTenantScope();
  const clients = useClients(activeOrganizationId);
  const projects = useProjects();
  const invoices = useInvoices({ orgId: activeOrganizationId });
  const unbilled = useUnbilledSummary(activeOrganizationId);
  const activeProjects = (projects.data ?? []).filter((project) => activeOrganizationId == null || project.status.toLowerCase() === "active");
  const activeClients = (clients.data ?? []).filter((client) => client.status === "active");
  const draftInvoices = (invoices.data ?? []).filter((invoice) => invoice.status === "draft").length;
  const unbilledHours = (unbilled.data?.by_project ?? []).reduce((sum, item) => sum + Number(item.hours), 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Revenue snapshot</CardTitle>
          <p className="mt-1 text-sm text-white/50">A compact view of the operating scope currently defining client and billing work.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-[20px] border border-white/8 bg-[linear-gradient(135deg,rgba(245,158,11,0.1),rgba(255,255,255,0.04))] px-4 py-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Active role</div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-white">{effectiveRole}</div>
              <div className="text-sm text-white/60">Finance visibility is filtered by the organization selected in the header.</div>
            </div>
            <Badge tone="default" className="whitespace-nowrap">{activeOrganizationId ? `Org ${activeOrganizationId}` : "Global"}</Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="rounded-[18px] border border-white/8 bg-white/[0.035] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">Active projects</div>
            <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{activeProjects.length}</div>
            <div className="mt-1 text-sm text-white/46">Projects available for delivery and time capture</div>
          </div>
          <div className="rounded-[18px] border border-white/8 bg-white/[0.035] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">Active clients</div>
            <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{activeClients.length}</div>
            <div className="mt-1 text-sm text-white/46">Accounts currently billable in this workspace</div>
          </div>
        </div>
        <div className="rounded-[18px] border border-white/8 bg-white/[0.035] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Invoice pressure</div>
              <div className="text-sm text-white/60">{draftInvoices} draft invoices, {unbilledHours.toFixed(2)} unbilled hours</div>
            </div>
            <Badge tone={draftInvoices > 0 || unbilledHours > 0 ? "warn" : "success"}>
              {draftInvoices > 0 || unbilledHours > 0 ? "Attention" : "Clear"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
