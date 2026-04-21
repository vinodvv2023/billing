"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Calculator, ExternalLink, ReceiptText, X } from "lucide-react";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { DataTable } from "@/ui/datatable";
import { Input } from "@/ui/input";
import { Skeleton } from "@/ui/skeleton";
import { useToast } from "@/ui/toast";
import {
  useAddInvoiceLine,
  useBillingRates,
  useClients,
  useCreateBillingRate,
  useGenerateInvoice,
  useInvoice,
  useInvoices,
  useProjects,
  useUnbilledSummary,
  useUpdateInvoice,
} from "@/lib/api-hooks";
import { useTenantScope } from "@/lib/tenant-scope";

const today = format(new Date(), "yyyy-MM-dd");

type InvoiceData = ReturnType<typeof useInvoice>["data"];

function openInvoiceRender(invoiceId: number) {
  const target = `/invoice-render/${invoiceId}`;
  const popup = window.open(target, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.assign(target);
  }
}

function invoiceTriggerClassName() {
  return "group cursor-pointer rounded-[12px] px-2 py-1.5 transition-colors hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-amber-400/60";
}

function InvoicePreviewModal({
  invoice,
  title,
  description,
  onClose,
  actions,
  notes,
}: {
  invoice: InvoiceData | undefined;
  title: string;
  description: string;
  onClose: () => void;
  actions?: React.ReactNode;
  notes?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[var(--bg-elevated)] shadow-[0_32px_80px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-white/40">{title}</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
              {invoice?.invoice_number ?? "Invoice detail"}
            </h2>
            <p className="mt-2 text-sm text-white/55">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Button size="sm" variant="ghost" onClick={onClose} leftIcon={<X className="h-4 w-4" />}>
              Close
            </Button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-96px)] overflow-y-auto px-6 py-6">
          {!invoice ? (
            <div className="rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-6 text-sm text-white/60">
              Loading invoice detail...
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-[18px] border border-white/8 bg-white/[0.035] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Issued</div>
                  <div className="mt-2 text-lg font-semibold text-white">{invoice.issue_date}</div>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-white/[0.035] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Period</div>
                  <div className="mt-2 text-sm font-semibold text-white">{invoice.period_start} to {invoice.period_end}</div>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-white/[0.035] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Total</div>
                  <div className="mt-2 text-lg font-semibold text-white">{invoice.total_amount} {invoice.currency}</div>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-white/[0.035] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Status</div>
                  <div className="mt-2 text-lg font-semibold capitalize text-white">{invoice.status}</div>
                </div>
              </div>

              <DataTable
                data={invoice.lines}
                emptyState="No line items on this invoice."
                columns={[
                  { key: "description", header: "Description" },
                  { key: "line_type", header: "Type" },
                  { key: "hours", header: "Hours" },
                  { key: "unit_price", header: "Rate" },
                  { key: "amount", header: "Amount" },
                ]}
              />

              {invoice.notes ? (
                <div className="rounded-[18px] border border-white/8 bg-white/[0.035] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Notes</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/72">{invoice.notes}</div>
                </div>
              ) : null}

              {notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { activeOrganizationId, effectiveRole } = useTenantScope();
  if (effectiveRole === "client") {
    return <ClientBillingPortal activeOrganizationId={activeOrganizationId} />;
  }
  return <InternalBillingPage activeOrganizationId={activeOrganizationId} effectiveRole={effectiveRole} />;
}

function ClientBillingPortal({ activeOrganizationId }: { activeOrganizationId: number | null }) {
  const invoices = useInvoices({ orgId: activeOrganizationId });
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const selectedInvoice = useInvoice(selectedInvoiceId);
  const visibleInvoices = useMemo(
    () => (invoices.data ?? []).filter((invoice) => invoice.status !== "draft"),
    [invoices.data]
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden border-white/12 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,0.04))]">
          <CardHeader><CardTitle>Invoices issued</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-white">{visibleInvoices.length}</div>
            <p className="mt-2 text-sm text-white/55">Only finalized client-facing invoices are shown here.</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-white/12 bg-[linear-gradient(135deg,rgba(96,165,250,0.12),rgba(255,255,255,0.04))]">
          <CardHeader><CardTitle>Awaiting payment</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-white">
              {visibleInvoices.filter((invoice) => invoice.status === "sent").length}
            </div>
            <p className="mt-2 text-sm text-white/55">Invoices that have already been issued and are still open.</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-white/12 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,0.04))]">
          <CardHeader><CardTitle>Paid</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-white">
              {visibleInvoices.filter((invoice) => invoice.status === "paid").length}
            </div>
            <p className="mt-2 text-sm text-white/55">Historical invoice records already closed out.</p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Invoices</CardTitle>
              <p className="mt-1 text-sm text-white/50">Issued invoices visible to your client account.</p>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={visibleInvoices}
              emptyState="No sent or finalized invoices are available in this client portal yet."
              columns={[
                {
                  key: "invoice_number",
                  header: "Invoice",
                  render: (row) => (
                    <button className={invoiceTriggerClassName()} onClick={() => setSelectedInvoiceId(row.id)}>
                      <div className="font-semibold text-white transition-colors group-hover:text-amber-100">{row.invoice_number}</div>
                      <div className="text-xs text-white/45">{row.issue_date}</div>
                    </button>
                  ),
                },
                { key: "total_amount", header: "Total" },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <Badge tone={row.status === "paid" ? "success" : row.status === "void" ? "warn" : "outline"}>
                      {row.status}
                    </Badge>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      </section>

      {selectedInvoiceId ? (
        <InvoicePreviewModal
          invoice={selectedInvoice.data}
          title="Client invoice preview"
          description="Review line items and invoice status without leaving the portal."
          onClose={() => setSelectedInvoiceId(null)}
          actions={
            selectedInvoice.data ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<ExternalLink className="h-4 w-4" />}
                  onClick={() => openInvoiceRender(selectedInvoice.data.id)}
                >
                  Open printable view
                </Button>
                <Badge tone="outline" className="border-white/12 bg-white/[0.04]">Read only</Badge>
              </>
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
}

function InternalBillingPage({
  activeOrganizationId,
  effectiveRole,
}: {
  activeOrganizationId: number | null;
  effectiveRole: string;
}) {
  const { activeTenant } = useTenantScope();
  const clients = useClients(activeOrganizationId);
  const projects = useProjects();
  const rates = useBillingRates(activeOrganizationId);
  const unbilled = useUnbilledSummary(activeOrganizationId);
  const invoices = useInvoices({ orgId: activeOrganizationId });
  const createRate = useCreateBillingRate();
  const generateInvoice = useGenerateInvoice();
  const updateInvoice = useUpdateInvoice();
  const addInvoiceLine = useAddInvoiceLine();
  const toast = useToast();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const selectedInvoice = useInvoice(selectedInvoiceId);
  const [rateForm, setRateForm] = useState({
    client_id: "",
    project_id: "",
    role: "",
    hourly_rate: "125.00",
    currency: "USD",
    effective_from: today,
  });
  const [invoiceForm, setInvoiceForm] = useState({
    client_id: "",
    period_start: today.slice(0, 8) + "01",
    period_end: today,
    issue_date: today,
    grouping_mode: "project",
    notes: "",
  });
  const [lineForm, setLineForm] = useState({ description: "", amount: "0.00" });
  const [financeSection, setFinanceSection] = useState<"overview" | "rates" | "invoices">("overview");

  const canManage = ["finance", "org_admin", "Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin"].includes(
    effectiveRole
  );
  const isFinanceView = effectiveRole === "finance";
  const scopedProjects = useMemo(
    () => (projects.data ?? []).filter((project) => !activeTenant || project.org === activeTenant.name),
    [activeTenant, projects.data]
  );

  return (
    <div className="space-y-6">
      {isFinanceView ? (
        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(255,255,255,0.04),rgba(14,165,233,0.08))] p-6">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs uppercase tracking-[0.22em] text-white/42">Finance desk</p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
              Rates, unbilled work, and invoice drafting in one billing-focused surface.
            </h2>
            <p className="text-sm leading-6 text-white/64 sm:text-[15px]">
              This page is tuned for finance operations: price approved work correctly, generate clean drafts, and move
              invoices forward without delivery or tenant-admin distractions.
            </p>
          </div>
        </section>
      ) : null}

      {isFinanceView ? (
        <section className="rounded-[22px] border border-white/8 bg-white/[0.03] p-2">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              {
                id: "overview" as const,
                title: "Overview",
                body: "Backlog, pricing coverage, and invoice movement.",
              },
              {
                id: "rates" as const,
                title: "Rates",
                body: "Set pricing rules without invoice noise in the way.",
              },
              {
                id: "invoices" as const,
                title: "Invoices",
                body: "Draft, send, and reconcile invoices in one queue.",
              },
            ].map((item) => {
              const active = financeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFinanceSection(item.id)}
                  className={
                    active
                      ? "rounded-[18px] border border-amber-400/35 bg-amber-500/10 px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "rounded-[18px] border border-transparent bg-transparent px-4 py-4 text-left hover:border-white/8 hover:bg-white/[0.03]"
                  }
                >
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="mt-1 text-sm leading-6 text-white/56">{item.body}</div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden border-white/12 bg-[linear-gradient(135deg,rgba(34,197,94,0.12),rgba(255,255,255,0.04))]">
          <CardHeader><CardTitle>Unbilled backlog</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-white">
              {(unbilled.data?.by_project ?? []).reduce((sum, item) => sum + Number(item.hours), 0).toFixed(2)}
            </div>
            <p className="mt-2 text-sm text-white/55">Approved hours still available for invoice generation.</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-white/12 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,0.04))]">
          <CardHeader><CardTitle>Draft invoices</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-white">
              {(invoices.data ?? []).filter((invoice) => invoice.status === "draft").length}
            </div>
            <p className="mt-2 text-sm text-white/55">Open invoice documents waiting on review or send.</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-white/12 bg-[linear-gradient(135deg,rgba(96,165,250,0.12),rgba(255,255,255,0.04))]">
          <CardHeader><CardTitle>Rate cards</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-white">{rates.data?.length ?? 0}</div>
            <p className="mt-2 text-sm text-white/55">Project, client, and role overrides active in this workspace.</p>
          </CardContent>
        </Card>
      </section>

      {(!isFinanceView || financeSection !== "invoices") ? (
        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          {(!isFinanceView || financeSection === "overview" || financeSection === "rates") ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{isFinanceView ? "Rate setup" : "Billing rate"}</CardTitle>
                  <p className="mt-1 text-sm text-white/50">
                    {isFinanceView
                      ? "Set the pricing rule that finance will use when approved time becomes invoice lines."
                      : "Define the hourly price used when approved time becomes invoice lines."}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-white/82">Client</span>
                    <select
                      value={rateForm.client_id}
                      onChange={(event) => setRateForm((current) => ({ ...current, client_id: event.target.value }))}
                      className="h-11 w-full rounded-[16px] border border-white/15 bg-white/[0.04] px-4 text-white"
                    >
                      <option value="">Any client</option>
                      {(clients.data ?? []).map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-white/82">Project</span>
                    <select
                      value={rateForm.project_id}
                      onChange={(event) => setRateForm((current) => ({ ...current, project_id: event.target.value }))}
                      className="h-11 w-full rounded-[16px] border border-white/15 bg-white/[0.04] px-4 text-white"
                    >
                      <option value="">Any project</option>
                      {scopedProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    label="Role"
                    value={rateForm.role}
                    onChange={(event) => setRateForm((current) => ({ ...current, role: event.target.value }))}
                    placeholder="employee"
                  />
                  <Input
                    label="Hourly rate"
                    value={rateForm.hourly_rate}
                    onChange={(event) => setRateForm((current) => ({ ...current, hourly_rate: event.target.value }))}
                  />
                  <Input
                    label="Currency"
                    value={rateForm.currency}
                    onChange={(event) => setRateForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                  />
                </div>
                <Input
                  label="Effective from"
                  type="date"
                  value={rateForm.effective_from}
                  onChange={(event) => setRateForm((current) => ({ ...current, effective_from: event.target.value }))}
                />
                <Button
                  className="w-full"
                  leftIcon={<Calculator className="h-4 w-4" />}
                  disabled={!activeOrganizationId || !canManage || createRate.isPending}
                  isLoading={createRate.isPending}
                  onClick={() => {
                    if (!activeOrganizationId) return;
                    createRate.mutate(
                      {
                        org_id: activeOrganizationId,
                        client_id: rateForm.client_id ? Number(rateForm.client_id) : null,
                        project_id: rateForm.project_id ? Number(rateForm.project_id) : null,
                        role: rateForm.role || null,
                        hourly_rate: rateForm.hourly_rate,
                        currency: rateForm.currency,
                        effective_from: rateForm.effective_from,
                      },
                      {
                        onSuccess: () => toast.push({ title: "Rate created", variant: "success" }),
                        onError: (error: Error) =>
                          toast.push({ title: "Rate failed", description: error.message, variant: "error" }),
                      }
                    );
                  }}
                >
                  {isFinanceView ? "Save pricing rule" : "Save rate"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {(!isFinanceView || financeSection === "overview" || financeSection === "invoices") ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{isFinanceView ? "Draft invoice" : "Generate invoice"}</CardTitle>
                  <p className="mt-1 text-sm text-white/50">
                    {isFinanceView
                      ? "Turn approved billable time into a client-ready draft invoice for review."
                      : "Convert approved billable time into a draft invoice for one client."}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-white/82">Client</span>
                  <select
                    value={invoiceForm.client_id}
                    onChange={(event) => setInvoiceForm((current) => ({ ...current, client_id: event.target.value }))}
                    className="h-11 w-full rounded-[16px] border border-white/15 bg-white/[0.04] px-4 text-white"
                  >
                    <option value="">Select client</option>
                    {(clients.data ?? []).map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    label="Period start"
                    type="date"
                    value={invoiceForm.period_start}
                    onChange={(event) => setInvoiceForm((current) => ({ ...current, period_start: event.target.value }))}
                  />
                  <Input
                    label="Period end"
                    type="date"
                    value={invoiceForm.period_end}
                    onChange={(event) => setInvoiceForm((current) => ({ ...current, period_end: event.target.value }))}
                  />
                  <Input
                    label="Issue date"
                    type="date"
                    value={invoiceForm.issue_date}
                    onChange={(event) => setInvoiceForm((current) => ({ ...current, issue_date: event.target.value }))}
                  />
                </div>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-white/82">Grouping</span>
                  <select
                    value={invoiceForm.grouping_mode}
                    onChange={(event) => setInvoiceForm((current) => ({ ...current, grouping_mode: event.target.value }))}
                    className="h-11 w-full rounded-[16px] border border-white/15 bg-white/[0.04] px-4 text-white"
                  >
                    <option value="project">Project</option>
                    <option value="task">Task</option>
                  </select>
                </label>
                <Input
                  label="Internal notes"
                  value={invoiceForm.notes}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="April delivery billable summary"
                />
                <Button
                  className="w-full"
                  leftIcon={<ReceiptText className="h-4 w-4" />}
                  disabled={!activeOrganizationId || !invoiceForm.client_id || !canManage || generateInvoice.isPending}
                  isLoading={generateInvoice.isPending}
                  onClick={() => {
                    if (!activeOrganizationId || !invoiceForm.client_id) return;
                    generateInvoice.mutate(
                      {
                        org_id: activeOrganizationId,
                        client_id: Number(invoiceForm.client_id),
                        period_start: invoiceForm.period_start,
                        period_end: invoiceForm.period_end,
                        issue_date: invoiceForm.issue_date,
                        currency: "USD",
                        grouping_mode: invoiceForm.grouping_mode,
                        notes: invoiceForm.notes || undefined,
                      },
                      {
                        onSuccess: (invoice) => {
                          toast.push({ title: `Invoice ${invoice.invoice_number} created`, variant: "success" });
                          setSelectedInvoiceId(invoice.id);
                          if (isFinanceView) setFinanceSection("invoices");
                        },
                        onError: (error: Error) =>
                          toast.push({ title: "Generation failed", description: error.message, variant: "error" }),
                      }
                    );
                  }}
                >
                  {isFinanceView ? "Create draft invoice" : "Generate draft invoice"}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      <section>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{isFinanceView ? "Invoice queue" : "Invoices"}</CardTitle>
              <p className="mt-1 text-sm text-white/50">
                {isFinanceView
                  ? "Draft and dispatched invoices for the selected organization, with fast access to send and payment actions."
                  : "Drafts and dispatched invoices for the selected organization."}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {invoices.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <DataTable
                data={invoices.data ?? []}
                emptyState="No invoices generated in this workspace yet."
                columns={[
                {
                  key: "invoice_number",
                  header: "Invoice",
                  render: (row) => (
                      <button className={invoiceTriggerClassName()} onClick={() => setSelectedInvoiceId(row.id)}>
                        <div className="font-semibold text-white transition-colors group-hover:text-amber-100">{row.invoice_number}</div>
                        <div className="text-xs text-white/45">{row.issue_date}</div>
                      </button>
                    ),
                  },
                  {
                    key: "client",
                    header: "Client",
                    render: (row) => (clients.data ?? []).find((client) => client.id === row.client_id)?.name ?? `#${row.client_id}`,
                  },
                  { key: "total_amount", header: "Total" },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <Badge tone={row.status === "paid" ? "success" : row.status === "void" ? "warn" : "outline"}>
                        {row.status}
                      </Badge>
                    ),
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </section>

      {selectedInvoiceId ? (
        <InvoicePreviewModal
          invoice={selectedInvoice.data}
          title="Internal invoice preview"
          description="Review line items, update status, and keep draft invoice work inside the billing surface."
          onClose={() => setSelectedInvoiceId(null)}
          actions={
            selectedInvoice.data ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<ExternalLink className="h-4 w-4" />}
                  onClick={() => openInvoiceRender(selectedInvoice.data.id)}
                >
                  Open render
                </Button>
                {selectedInvoice.data.status === "draft" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateInvoice.mutate(
                        { invoiceId: selectedInvoice.data.id, status: "sent" },
                        {
                          onSuccess: () => toast.push({ title: "Invoice marked sent", variant: "success" }),
                          onError: (error: Error) =>
                            toast.push({ title: "Status update failed", description: error.message, variant: "error" }),
                        }
                      )
                    }
                  >
                    Mark sent
                  </Button>
                ) : null}
                {selectedInvoice.data.status === "sent" ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      updateInvoice.mutate(
                        { invoiceId: selectedInvoice.data.id, status: "paid" },
                        {
                          onSuccess: () => toast.push({ title: "Invoice marked paid", variant: "success" }),
                          onError: (error: Error) =>
                            toast.push({ title: "Status update failed", description: error.message, variant: "error" }),
                        }
                      )
                    }
                  >
                    Mark paid
                  </Button>
                ) : null}
              </>
            ) : undefined
          }
          notes={
            selectedInvoice.data?.status === "draft" && canManage ? (
              <div className="space-y-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div>
                  <div className="text-sm font-semibold text-white">Manual line item</div>
                  <p className="mt-1 text-xs text-white/45">Add a supplemental charge or adjustment to the current draft.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
                  <Input
                    label="Description"
                    value={lineForm.description}
                    onChange={(event) => setLineForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Retainer adjustment"
                  />
                  <Input
                    label="Amount"
                    value={lineForm.amount}
                    onChange={(event) => setLineForm((current) => ({ ...current, amount: event.target.value }))}
                  />
                  <Button
                    className="mt-auto"
                    disabled={!lineForm.description || addInvoiceLine.isPending}
                    isLoading={addInvoiceLine.isPending}
                    onClick={() =>
                      addInvoiceLine.mutate(
                        {
                          invoiceId: selectedInvoice.data.id,
                          description: lineForm.description,
                          amount: lineForm.amount,
                          line_type: "manual",
                        },
                        {
                          onSuccess: () => {
                            toast.push({ title: "Manual line added", variant: "success" });
                            setLineForm({ description: "", amount: "0.00" });
                          },
                          onError: (error: Error) =>
                            toast.push({ title: "Line failed", description: error.message, variant: "error" }),
                        }
                      )
                    }
                  >
                    Add line
                  </Button>
                </div>
              </div>
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
}
