import { AppShell } from "@/components/app-shell";
import { AdminDashboard } from "@/components/admin-dashboard";
import { FlashMessage } from "@/components/flash-message";
import { requireUser } from "@/lib/auth";
import { getAdminDashboardData } from "@/lib/data";
import { getFlashMessage } from "@/lib/flash";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const currentUser = await requireUser("ADMIN");
  const data = getAdminDashboardData();
  const flash = await getFlashMessage();

  return (
    <AppShell
      user={currentUser}
      title="Dashboard"
      subtitle="Manage tickets, clients, and your overall workload from one place."
    >
      <FlashMessage message={flash?.message} tone={flash?.tone || "success"} />
      <AdminDashboard data={data} />
    </AppShell>
  );
}
