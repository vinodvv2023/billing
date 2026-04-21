"use client";

import { useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Clock3, Send, SquareCheckBig } from "lucide-react";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { DataTable } from "@/ui/datatable";
import { Input } from "@/ui/input";
import { Skeleton } from "@/ui/skeleton";
import { useToast } from "@/ui/toast";
import {
  useBulkApproveTimesheets,
  useBulkRejectTimesheets,
  useClients,
  useCreateTimesheetEntry,
  useProjects,
  useSubmitTimesheetEntry,
  useTasks,
  useTimesheetApprovals,
  useTimesheetEntries,
  useTimesheetSummary,
} from "@/lib/api-hooks";
import { useSession } from "@/lib/session";
import { useTenantScope } from "@/lib/tenant-scope";
import { ClientPortalRedirect } from "@/components/client-portal-redirect";

const today = new Date();
const defaultDate = format(today, "yyyy-MM-dd");
const periodStart = format(startOfMonth(today), "yyyy-MM-dd");
const periodEnd = format(endOfMonth(today), "yyyy-MM-dd");

export default function TimesheetsPage() {
  const { effectiveRole } = useTenantScope();
  if (effectiveRole === "client") {
    return (
      <ClientPortalRedirect
        title="Redirecting to invoices"
        description="Timesheets are available only to internal delivery roles such as employees and project managers. Client logins are redirected to the invoice portal."
      />
    );
  }
  return <InternalTimesheetsPage />;
}

function InternalTimesheetsPage() {
  const { activeOrganizationId, activeTenant, effectiveRole } = useTenantScope();
  const { userId } = useSession();
  const projects = useProjects();
  const projectOptions = useMemo(
    () => (projects.data ?? []).filter((item) => !activeTenant || item.org === activeTenant.name),
    [activeTenant, projects.data]
  );
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(projectOptions[0]?.id ?? null);
  const tasks = useTasks(selectedProjectId);
  const clients = useClients(activeOrganizationId);
  const createEntry = useCreateTimesheetEntry();
  const submitEntry = useSubmitTimesheetEntry();
  const bulkApprove = useBulkApproveTimesheets();
  const bulkReject = useBulkRejectTimesheets();
  const toast = useToast();
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<number[]>([]);
  const [form, setForm] = useState({
    entry_date: defaultDate,
    hours: "8.00",
    description: "",
    task_id: "",
    client_id: "",
  });

  const canReview = ["project_manager", "org_admin", "Super Admin", "Agency Admin", "Agency Company Admin", "Company Admin"].includes(
    effectiveRole
  );
  const isEmployeeView = effectiveRole === "employee";
  const entries = useTimesheetEntries({
    orgId: activeOrganizationId,
    userId: isEmployeeView ? (userId ?? undefined) : undefined,
    dateFrom: periodStart,
    dateTo: periodEnd,
  });
  const approvals = useTimesheetApprovals({ orgId: canReview ? activeOrganizationId : null });
  const summary = useTimesheetSummary({
    orgId: isEmployeeView ? null : activeOrganizationId,
    dateFrom: periodStart,
    dateTo: periodEnd,
  });

  const employeeStats = useMemo(() => {
    const rows = entries.data ?? [];
    const totalHours = rows.reduce((sum, row) => sum + Number(row.hours), 0);
    const billableHours = rows.filter((row) => row.billable).reduce((sum, row) => sum + Number(row.hours), 0);
    const draftCount = rows.filter((row) => row.status === "draft").length;
    return {
      totalHours: totalHours.toFixed(2),
      billableHours: billableHours.toFixed(2),
      draftCount,
    };
  }, [entries.data]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden border-white/12 bg-[linear-gradient(135deg,rgba(96,165,250,0.14),rgba(255,255,255,0.04),rgba(245,158,11,0.08))]">
          <CardHeader>
            <div>
              <CardTitle>{isEmployeeView ? "My timesheet flow" : "Timesheet rhythm"}</CardTitle>
              <p className="mt-1 text-sm text-white/55">
                {isEmployeeView
                  ? "Log your work, keep drafts under control, and move entries into review without extra admin noise."
                  : "Capture delivery, keep the approval queue moving, and make billable hours visible before month-end."}
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">Hours this month</div>
              <div className="mt-2 text-3xl font-semibold text-white">
                {isEmployeeView ? employeeStats.totalHours : (summary.data?.total_hours ?? "--")}
              </div>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">Billable</div>
              <div className="mt-2 text-3xl font-semibold text-white">
                {isEmployeeView ? employeeStats.billableHours : (summary.data?.billable_hours ?? "--")}
              </div>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                {isEmployeeView ? "Draft entries" : "Pending approval"}
              </div>
              <div className="mt-2 text-3xl font-semibold text-white">
                {isEmployeeView ? employeeStats.draftCount : (approvals.data?.length ?? 0)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Log new entry</CardTitle>
              <p className="mt-1 text-sm text-white/55">Create a draft entry against the active project scope.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="block space-y-1.5 text-sm">
              <span className="text-white/82">Project</span>
              <select
                value={selectedProjectId ?? ""}
                onChange={(event) => setSelectedProjectId(Number(event.target.value) || null)}
                className="h-11 w-full rounded-[16px] border border-white/15 bg-white/[0.04] px-4 text-white outline-none focus:border-amber-400/70"
              >
                <option value="">Select project</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Date"
                type="date"
                value={form.entry_date}
                onChange={(event) => setForm((current) => ({ ...current, entry_date: event.target.value }))}
              />
              <Input
                label="Hours"
                value={form.hours}
                onChange={(event) => setForm((current) => ({ ...current, hours: event.target.value }))}
              />
            </div>
            <label className="block space-y-1.5 text-sm">
              <span className="text-white/82">Task</span>
              <select
                value={form.task_id}
                onChange={(event) => setForm((current) => ({ ...current, task_id: event.target.value }))}
                className="h-11 w-full rounded-[16px] border border-white/15 bg-white/[0.04] px-4 text-white outline-none focus:border-amber-400/70"
              >
                <option value="">No task</option>
                {(tasks.data ?? []).map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-white/82">Client</span>
              <select
                value={form.client_id}
                onChange={(event) => setForm((current) => ({ ...current, client_id: event.target.value }))}
                className="h-11 w-full rounded-[16px] border border-white/15 bg-white/[0.04] px-4 text-white outline-none focus:border-amber-400/70"
              >
                <option value="">Use project default</option>
                {(clients.data ?? []).map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Implementation, QA, client revisions"
            />
            <Button
              className="w-full"
              isLoading={createEntry.isPending}
              disabled={!selectedProjectId || createEntry.isPending}
              leftIcon={<Clock3 className="h-4 w-4" />}
              onClick={() => {
                if (!selectedProjectId) return;
                createEntry.mutate(
                  {
                    project_id: selectedProjectId,
                    task_id: form.task_id ? Number(form.task_id) : null,
                    client_id: form.client_id ? Number(form.client_id) : null,
                    entry_date: form.entry_date,
                    hours: form.hours,
                    description: form.description || undefined,
                    billable: true,
                  },
                  {
                    onSuccess: () => {
                      toast.push({ title: "Entry logged", variant: "success" });
                      setForm((current) => ({ ...current, description: "", hours: "8.00", task_id: "", client_id: "" }));
                    },
                    onError: (error: Error) =>
                      toast.push({ title: "Entry failed", description: error.message, variant: "error" }),
                  }
                );
              }}
            >
              Save draft
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{isEmployeeView ? "My entries this month" : "Current period entries"}</CardTitle>
            <p className="mt-1 text-sm text-white/50">
              {isEmployeeView
                ? "Your draft, submitted, approved, and rejected entries for the current month."
                : "Drafts and approved work for the current month."}
            </p>
          </div>
          <Badge tone="outline" className="border-white/12 bg-white/[0.04]">
            {entries.data?.length ?? 0} records
          </Badge>
        </CardHeader>
        <CardContent>
          {entries.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              data={entries.data ?? []}
              emptyState="No timesheet entries in the selected period."
              columns={[
                { key: "entry_date", header: "Date" },
                {
                  key: "project_id",
                  header: "Project",
                  render: (row) => projectOptions.find((project) => project.id === row.project_id)?.name ?? `#${row.project_id}`,
                },
                { key: "hours", header: "Hours" },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <Badge tone={row.status === "approved" ? "success" : row.status === "submitted" ? "default" : "outline"}>
                      {row.status}
                    </Badge>
                  ),
                },
                {
                  key: "description",
                  header: "Notes",
                  render: (row) => row.description || <span className="text-white/35">No detail</span>,
                },
                {
                  key: "actions",
                  header: "Actions",
                  width: "140px",
                  render: (row) =>
                    row.status === "draft" || row.status === "rejected" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={submitEntry.isPending}
                        leftIcon={<Send className="h-4 w-4" />}
                        onClick={() =>
                          submitEntry.mutate(row.id, {
                            onSuccess: () => toast.push({ title: "Entry submitted", variant: "success" }),
                            onError: (error: Error) =>
                              toast.push({ title: "Submit failed", description: error.message, variant: "error" }),
                          })
                        }
                      >
                        Submit
                      </Button>
                    ) : (
                      <span className="text-xs text-white/35">No action</span>
                    ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      {canReview ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Approval queue</CardTitle>
              <p className="mt-1 text-sm text-white/50">Submitted entries awaiting manager or admin review.</p>
            </div>
            {selectedApprovalIds.length > 0 ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  leftIcon={<SquareCheckBig className="h-4 w-4" />}
                  isLoading={bulkApprove.isPending}
                  onClick={() =>
                    bulkApprove.mutate(
                      { entry_ids: selectedApprovalIds },
                      {
                        onSuccess: () => {
                          toast.push({ title: "Entries approved", variant: "success" });
                          setSelectedApprovalIds([]);
                        },
                        onError: (error: Error) =>
                          toast.push({ title: "Approval failed", description: error.message, variant: "error" }),
                      }
                    )
                  }
                >
                  Approve selected
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isLoading={bulkReject.isPending}
                  onClick={() =>
                    bulkReject.mutate(
                      { entry_ids: selectedApprovalIds, reason: "Needs revision" },
                      {
                        onSuccess: () => {
                          toast.push({ title: "Entries rejected", variant: "success" });
                          setSelectedApprovalIds([]);
                        },
                        onError: (error: Error) =>
                          toast.push({ title: "Reject failed", description: error.message, variant: "error" }),
                      }
                    )
                  }
                >
                  Reject selected
                </Button>
              </div>
            ) : (
              <Badge tone="outline" className="border-white/12 bg-white/[0.04]">
                {approvals.data?.length ?? 0} waiting
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <DataTable
              data={approvals.data ?? []}
              emptyState="No submitted entries are waiting in your scope."
              columns={[
                {
                  key: "select",
                  header: "",
                  width: "48px",
                  render: (row) => (
                    <input
                      type="checkbox"
                      checked={selectedApprovalIds.includes(row.id)}
                      onChange={(event) =>
                        setSelectedApprovalIds((current) =>
                          event.target.checked ? [...current, row.id] : current.filter((item) => item !== row.id)
                        )
                      }
                    />
                  ),
                },
                { key: "entry_date", header: "Date" },
                {
                  key: "project",
                  header: "Project",
                  render: (row) => projectOptions.find((project) => project.id === row.project_id)?.name ?? `#${row.project_id}`,
                },
                { key: "hours", header: "Hours" },
                {
                  key: "description",
                  header: "Detail",
                  render: (row) => row.description || <span className="text-white/35">No detail</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <Badge tone="default">{row.status}</Badge>,
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
