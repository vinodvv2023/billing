"use client";

import { endOfMonth, format, startOfMonth } from "date-fns";
import { Badge } from "@/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { useSession } from "@/lib/session";
import {
  useBillingRates,
  useInvoices,
  useTimesheetApprovals,
  useTimesheetEntries,
  useTimesheetSummary,
  useUnbilledSummary,
} from "@/lib/api-hooks";
import { useTenantScope } from "@/lib/tenant-scope";
import { SummaryCards } from "./_components/summary-cards";
import { ActivityFeed } from "./_components/activity-feed";
import { RoleMatrixMini } from "./_components/role-matrix-mini";

const today = new Date();
const periodStart = format(startOfMonth(today), "yyyy-MM-dd");
const periodEnd = format(endOfMonth(today), "yyyy-MM-dd");

export default function DashboardPage() {
  const { activeOrganizationId, effectiveRole } = useTenantScope();

  if (effectiveRole === "client") {
    return <ClientDashboard activeOrganizationId={activeOrganizationId} />;
  }

  if (effectiveRole === "employee") {
    return <EmployeeDashboard activeOrganizationId={activeOrganizationId} />;
  }

  if (effectiveRole === "finance") {
    return <FinanceDashboard activeOrganizationId={activeOrganizationId} />;
  }

  if (effectiveRole === "project_manager") {
    return <ManagerDashboard activeOrganizationId={activeOrganizationId} />;
  }

  return <AdminDashboard />;
}

function ClientDashboard({ activeOrganizationId }: { activeOrganizationId: number | null }) {
  const invoices = useInvoices({ orgId: activeOrganizationId });
  const visibleInvoices = (invoices.data ?? []).filter((invoice) => invoice.status !== "draft");
  const openInvoices = visibleInvoices.filter((invoice) => invoice.status === "sent").length;
  const paidInvoices = visibleInvoices.filter((invoice) => invoice.status === "paid").length;

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,0.04),rgba(96,165,250,0.08))] p-6">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-white/42">Client portal</p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
            Review finalized invoices and account history without exposing internal operations.
          </h2>
          <p className="text-sm leading-6 text-white/64 sm:text-[15px]">
            This view is intentionally limited to client-safe billing visibility. Drafts, internal rate setup, time capture,
            and admin workflows stay on the internal workspace side.
          </p>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Total invoices" value={String(visibleInvoices.length)} detail="Sent and finalized billing documents in your client scope." />
        <MetricCard title="Open invoices" value={String(openInvoices)} detail="Invoices already issued and still awaiting payment." />
        <MetricCard title="Paid invoices" value={String(paidInvoices)} detail="Completed invoice records visible in this portal." />
      </div>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Portal access</CardTitle>
            <p className="mt-1 text-sm text-white/50">Use the invoice screen for detailed line items and invoice status.</p>
          </div>
          <Badge tone="outline" className="border-white/12 bg-white/[0.04]">Read only</Badge>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-white/64">
          Client logins can review invoice history and invoice detail only. Internal delivery, timesheets, rate cards,
          project tasks, and admin tools are intentionally hidden from this portal.
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeDashboard({ activeOrganizationId }: { activeOrganizationId: number | null }) {
  const { userId } = useSession();
  const summary = useTimesheetSummary({ orgId: activeOrganizationId, dateFrom: periodStart, dateTo: periodEnd });
  const entries = useTimesheetEntries({
    orgId: activeOrganizationId,
    userId: userId ?? undefined,
    dateFrom: periodStart,
    dateTo: periodEnd,
  });

  const myEntries = entries.data ?? [];
  const draftCount = myEntries.filter((entry) => entry.status === "draft").length;
  const submittedCount = myEntries.filter((entry) => entry.status === "submitted").length;
  const rejectedCount = myEntries.filter((entry) => entry.status === "rejected").length;
  const recentEntries = myEntries.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(56,189,248,0.16),rgba(255,255,255,0.04),rgba(245,158,11,0.08))] p-6">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-white/42">Personal workspace</p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
            Log your work, track submissions, and keep your month current.
          </h2>
          <p className="text-sm leading-6 text-white/64 sm:text-[15px]">
            This workspace is intentionally limited to your delivery flow. Administrative screens, billing controls,
            and organization setup are hidden to keep the surface focused.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Hours this month" value={summary.data?.total_hours ?? "--"} detail="All hours you have logged in the current month." />
        <MetricCard title="Billable hours" value={summary.data?.billable_hours ?? "--"} detail="Hours currently marked billable in this period." />
        <MetricCard title="Draft entries" value={String(draftCount)} detail="Entries still waiting for submission." />
        <MetricCard title="Needs attention" value={String(rejectedCount)} detail="Rejected entries that likely need revision and resubmission." />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>My submission status</CardTitle>
              <p className="mt-1 text-sm text-white/50">Your current month workflow at a glance.</p>
            </div>
            <Badge tone="outline" className="border-white/12 bg-white/[0.04]">{myEntries.length} entries</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <StatusTile label="Draft" value={draftCount} tone="outline" />
            <StatusTile label="Submitted" value={submittedCount} tone="default" />
            <StatusTile label="Rejected" value={rejectedCount} tone="warn" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What to do next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-white/68">
            <ActionLine title="Log time daily" body="Keep entries current instead of waiting until the end of the week." />
            <ActionLine title="Submit drafts" body="Draft entries are not visible to approvers until you submit them." />
            <ActionLine title="Fix rejected work" body="If an entry was rejected, update the notes or hours in Timesheets and resubmit it." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Recent entries</CardTitle>
            <p className="mt-1 text-sm text-white/50">A short list of your latest entries in the current month.</p>
          </div>
          <Badge tone="outline" className="border-white/12 bg-white/[0.04]">Timesheets only</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentEntries.length === 0 ? (
            <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-white/58">
              No entries yet for this period. Use the Timesheets screen to log your first entry.
            </div>
          ) : (
            recentEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <div>
                  <div className="text-sm font-semibold text-white">{entry.entry_date}</div>
                  <div className="mt-1 text-sm text-white/56">{entry.description || "No detail added"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold text-white">{entry.hours}h</div>
                  <Badge tone={entry.status === "submitted" ? "default" : entry.status === "rejected" ? "warn" : "outline"}>
                    {entry.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceDashboard({ activeOrganizationId }: { activeOrganizationId: number | null }) {
  const invoices = useInvoices({ orgId: activeOrganizationId });
  const rates = useBillingRates(activeOrganizationId);
  const unbilled = useUnbilledSummary(activeOrganizationId);

  const sentCount = (invoices.data ?? []).filter((invoice) => invoice.status === "sent").length;
  const draftCount = (invoices.data ?? []).filter((invoice) => invoice.status === "draft").length;
  const paidCount = (invoices.data ?? []).filter((invoice) => invoice.status === "paid").length;
  const recentInvoices = (invoices.data ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(255,255,255,0.04),rgba(14,165,233,0.08))] p-6">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-white/42">Finance workspace</p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
            Keep approved work moving into invoices without delivery and admin overload.
          </h2>
          <p className="text-sm leading-6 text-white/64 sm:text-[15px]">
            This surface is focused on rates, unbilled work, draft invoices, and billing status. Internal access tools and
            delivery setup are intentionally kept out of the way.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Rate cards" value={String(rates.data?.length ?? 0)} detail="Active and historical pricing rows in this organization." />
        <MetricCard title="Draft invoices" value={String(draftCount)} detail="Invoices still being reviewed before send-out." />
        <MetricCard title="Sent invoices" value={String(sentCount)} detail="Invoices already issued to clients." />
        <MetricCard title="Paid invoices" value={String(paidCount)} detail="Invoices marked as fully paid." />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Unbilled approved work</CardTitle>
            <p className="mt-1 text-sm text-white/50">Use Billing to turn approved hours into draft invoices.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <MetricInline label="Entries waiting" value={String(unbilled.data?.entry_count ?? 0)} />
            <MetricInline label="Projects with unbilled time" value={String(unbilled.data?.by_project.length ?? 0)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Finance focus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-white/68">
            <ActionLine title="Review rates first" body="Project and client rate coverage should be correct before generating invoice drafts." />
            <ActionLine title="Generate drafts from approved work" body="Only approved billable entries should progress into invoice generation." />
            <ActionLine title="Send only finalized drafts" body="Client visibility begins once invoice status moves from draft to sent." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Recent invoices</CardTitle>
            <p className="mt-1 text-sm text-white/50">Latest invoice activity in the active organization.</p>
          </div>
          <Badge tone="outline" className="border-white/12 bg-white/[0.04]">{recentInvoices.length} visible</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentInvoices.length === 0 ? (
            <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-white/58">
              No invoices yet. Use the Billing screen to generate the first draft invoice.
            </div>
          ) : (
            recentInvoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <div>
                  <div className="text-sm font-semibold text-white">{invoice.invoice_number}</div>
                  <div className="mt-1 text-sm text-white/56">{invoice.issue_date}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold text-white">{invoice.total_amount} {invoice.currency}</div>
                  <Badge tone={invoice.status === "paid" ? "success" : invoice.status === "sent" ? "default" : "outline"}>
                    {invoice.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ManagerDashboard({ activeOrganizationId }: { activeOrganizationId: number | null }) {
  const approvals = useTimesheetApprovals({ orgId: activeOrganizationId });
  const summary = useTimesheetSummary({ orgId: activeOrganizationId, dateFrom: periodStart, dateTo: periodEnd });

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(168,85,247,0.12),rgba(255,255,255,0.04),rgba(34,197,94,0.08))] p-6">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-white/42">Manager workspace</p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
            Clear the approval queue and keep assigned delivery moving.
          </h2>
          <p className="text-sm leading-6 text-white/64 sm:text-[15px]">
            This view stays centered on timesheet review and managed project visibility instead of finance or tenant setup.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Pending approvals" value={String(approvals.data?.length ?? 0)} detail="Submitted entries waiting in your review scope." />
        <MetricCard title="Hours this month" value={summary.data?.total_hours ?? "--"} detail="Total tracked hours in the active organization this month." />
        <MetricCard title="Billable hours" value={summary.data?.billable_hours ?? "--"} detail="Billable hours that may later move into invoicing." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue focus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-white/68">
          <ActionLine title="Review submitted entries quickly" body="Shorter approval cycles reduce billing lag and employee confusion." />
          <ActionLine title="Reject with usable detail" body="Clear rejection reasons help contributors correct work without back-and-forth." />
          <ActionLine title="Use Timesheets as your main operating screen" body="That screen contains the queue and bulk approval actions." />
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,0.04),rgba(96,165,250,0.08))] p-6">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-white/42">Daily visibility</p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
            Keep billable work flowing from delivery to draft invoice without losing control.
          </h2>
          <p className="text-sm leading-6 text-white/64 sm:text-[15px]">
            Review client load, approval queues, and invoice readiness without forcing operations and finance teams to
            jump between disconnected pages.
          </p>
        </div>
      </section>
      <SummaryCards />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
        <RoleMatrixMini />
      </div>
    </div>
  );
}

function MetricCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-semibold tracking-[-0.04em] text-white">{value}</div>
        <div className="mt-2 text-sm text-white/50">{detail}</div>
      </CardContent>
    </Card>
  );
}

function MetricInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</div>
    </div>
  );
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "outline" | "default" | "warn";
}) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-white/74">{label}</div>
        <Badge tone={tone}>{value}</Badge>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</div>
    </div>
  );
}

function ActionLine({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm text-white/58">{body}</div>
    </div>
  );
}
