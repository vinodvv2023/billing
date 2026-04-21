"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { useClients, useInvoices, useTimesheetApprovals, useUnbilledSummary } from "@/lib/api-hooks";
import { BriefcaseBusiness, CircleDollarSign, ClipboardList, FileSpreadsheet } from "lucide-react";
import { useTenantScope } from "@/lib/tenant-scope";

export function SummaryCards() {
  const { activeOrganizationId } = useTenantScope();
  const clients = useClients(activeOrganizationId);
  const approvals = useTimesheetApprovals({ orgId: activeOrganizationId });
  const unbilled = useUnbilledSummary(activeOrganizationId);
  const invoices = useInvoices({ orgId: activeOrganizationId });

  const clientCount = (clients.data ?? []).filter((item) => item.status === "active").length;
  const approvalCount = (approvals.data ?? []).length;
  const unbilledHours = (unbilled.data?.by_project ?? []).reduce((sum, item) => sum + Number(item.hours), 0);
  const draftInvoices = (invoices.data ?? []).filter((item) => item.status === "draft").length;

  const summary = [
    {
      label: "Active clients",
      value: clientCount,
      badge: clientCount === 1 ? "1 account" : `${clientCount} accounts`,
      note: "Billable relationships in play",
      icon: <BriefcaseBusiness className="h-4 w-4" />,
    },
    {
      label: "Pending approvals",
      value: approvalCount,
      badge: approvalCount > 0 ? "Needs review" : "Queue clear",
      note: "Submitted entries waiting on decision",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      label: "Unbilled hours",
      value: unbilledHours.toFixed(2),
      badge: unbilled.data?.entry_count ? `${unbilled.data.entry_count} entries` : "No backlog",
      note: "Approved time still waiting on invoice generation",
      icon: <CircleDollarSign className="h-4 w-4" />,
    },
    {
      label: "Draft invoices",
      value: draftInvoices,
      badge: draftInvoices > 0 ? "Ready to send" : "Nothing open",
      note: draftInvoices > 0 ? "Finance can finalize and dispatch" : "No draft invoices in this scope",
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
  ];
  const isLoading = clients.isLoading || approvals.isLoading || unbilled.isLoading || invoices.isLoading;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summary.map((item) => (
        <Card key={item.label} className="overflow-hidden">
          <CardHeader className="relative">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/16 to-transparent" />
            <div className="flex w-full items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-medium text-white/58">{item.label}</CardTitle>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/34">{item.note}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] p-2 text-amber-200">
                {item.icon}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <div>
              <div className="text-4xl font-semibold tracking-[-0.05em] text-white">
                {isLoading ? "--" : item.value}
              </div>
              <div className="mt-2 text-sm text-white/46">
                {isLoading ? "Refreshing metrics" : "Updated from live tenant data"}
              </div>
            </div>
            <Badge tone="outline" className="border-white/12 bg-white/[0.04]">
              {item.badge}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
