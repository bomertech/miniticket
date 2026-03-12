import { AppShell } from "@/components/app-shell";
import { ClientNewRequestButton } from "@/components/client-new-request-button";
import { ClientProjectToolbar } from "@/components/client-project-toolbar";
import { ClientTicketTable } from "@/components/client-ticket-table";
import { FlashMessage } from "@/components/flash-message";
import { requireUser } from "@/lib/auth";
import { getClientDashboardData } from "@/lib/data";
import { getFlashMessage } from "@/lib/flash";
import { getSelectedProjectId } from "@/lib/project-selection";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage() {
  const currentUser = await requireUser("CLIENT");
  const selectedProjectId = await getSelectedProjectId();
  const data = getClientDashboardData(currentUser.id, selectedProjectId ?? undefined);
  const flash = await getFlashMessage();
  const completedTickets = data.tickets.filter((ticket) => ticket.status === "DONE").length;

  return (
    <AppShell
      user={currentUser}
      title="Dashboard"
      subtitle="Submit requests, track progress, and review completed work."
      toolbarCenter={
        <ClientProjectToolbar
          projects={data.projects}
          selectedProjectId={data.selectedProject?.id || null}
        />
      }
    >
      <FlashMessage message={flash?.message} tone={flash?.tone || "success"} />

      {/* Metrics */}
      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-card__label">Project</span>
          <span className="stat-card__value stat-card__value--project">
            {data.selectedProject?.name || "None"}
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Open</span>
          <span className="stat-card__value">{data.openTickets}</span>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">In review</span>
          <span className="stat-card__value">{data.reviewTickets}</span>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Completed</span>
          <span className="stat-card__value">{completedTickets}</span>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div className="panel__header-main">
            <h2 className="panel__title">Tickets</h2>
            <span className="panel__count">{data.tickets.length}</span>
          </div>
          <ClientNewRequestButton selectedProject={data.selectedProject} />
        </div>

        {data.tickets.length === 0 ? (
          <div className="empty-state">
            {data.selectedProject ? (
              <>
                <h3>No tickets yet</h3>
                <p>
                  Use the New Request button to submit your first ticket for this project.
                </p>
              </>
            ) : (
              <>
                <h3>No active projects</h3>
                <p>Your admin needs to add a project before you can submit tickets.</p>
              </>
            )}
          </div>
        ) : (
          <ClientTicketTable tickets={data.tickets} />
        )}
      </section>
    </AppShell>
  );
}
