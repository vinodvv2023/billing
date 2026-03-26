import { AppShell } from "@/ui/app-shell";
import { RequireAuth } from "./_components/require-auth";

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
