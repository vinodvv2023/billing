import { SummaryCards } from "./_components/summary-cards";
import { ActivityFeed } from "./_components/activity-feed";
import { RoleMatrixMini } from "./_components/role-matrix-mini";

export default function DashboardPage() {
  return (
    <div className="space-y-5">
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
