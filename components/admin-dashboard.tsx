"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

import { createClientAction, createProjectAction, updateTicketAction } from "@/app/actions";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import type { AdminDashboardData } from "@/lib/types";
import { formatDateTime, formatStatusLabel } from "@/lib/utils";

type AdminTab = "tickets" | "clients" | "overview";
type AdminDialog = "add-client";

interface AdminDashboardProps {
  data: AdminDashboardData;
}

const ADMIN_TABS: Array<{ id: AdminTab; label: string }> = [
  { id: "tickets", label: "Tickets" },
  { id: "clients", label: "Clients" },
  { id: "overview", label: "Overview" }
];

function isAdminTab(value: string | null): value is AdminTab {
  return ADMIN_TABS.some((tab) => tab.id === value);
}

function isAdminDialog(value: string | null): value is AdminDialog {
  return value === "add-client";
}

export function AdminDashboard({ data }: AdminDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);

  const tabParam = searchParams.get("tab");
  const dialogParam = searchParams.get("dialog");
  const activeTab: AdminTab = isAdminTab(tabParam) ? tabParam : "tickets";
  const activeDialog: AdminDialog | null = isAdminDialog(dialogParam) ? dialogParam : null;
  const selectedTicketId = Number.parseInt(searchParams.get("ticket") || "", 10);
  const selectedTicket = activeTab === "tickets" && Number.isFinite(selectedTicketId)
    ? data.openTickets.find((ticket) => ticket.id === selectedTicketId) ?? null
    : null;
  const selectedTicketIndex = selectedTicket
    ? data.openTickets.findIndex((ticket) => ticket.id === selectedTicket.id)
    : -1;
  const previousTicket = selectedTicketIndex > 0 ? data.openTickets[selectedTicketIndex - 1] : null;
  const nextTicket =
    selectedTicketIndex >= 0 && selectedTicketIndex < data.openTickets.length - 1
      ? data.openTickets[selectedTicketIndex + 1]
      : null;
  const selectedClientId = Number.parseInt(searchParams.get("client") || "", 10);
  const selectedClient = activeTab === "clients" && Number.isFinite(selectedClientId)
    ? data.clients.find((client) => client.id === selectedClientId) ?? null
    : null;
  const selectedClientProjects = selectedClient
    ? data.projects.filter((project) => project.clientId === selectedClient.id)
    : [];
  const hasModal = activeDialog === "add-client" || Boolean(selectedTicket) || Boolean(selectedClient);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!hasModal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (selectedTicket) {
          closeTicket();
          return;
        }

        if (selectedClient) {
          closeClient();
          return;
        }

        if (activeDialog === "add-client") {
          closeAddClientDialog();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDialog, hasModal, selectedClient, selectedTicket]);

  function buildUrl({
    tab = activeTab,
    ticketId,
    clientId,
    dialog
  }: {
    tab?: AdminTab;
    ticketId?: number | null;
    clientId?: number | null;
    dialog?: AdminDialog | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    params.set("tab", tab);

    if (tab === "tickets") {
      params.delete("client");
      params.delete("dialog");

      if (typeof ticketId === "number") {
        params.set("ticket", String(ticketId));
      } else if (ticketId === null) {
        params.delete("ticket");
      }
    } else if (tab === "clients") {
      params.delete("ticket");

      if (typeof clientId === "number") {
        params.set("client", String(clientId));
      } else if (clientId === null) {
        params.delete("client");
      }

      if (dialog) {
        params.set("dialog", dialog);
      } else if (dialog === null) {
        params.delete("dialog");
      }
    } else {
      params.delete("ticket");
      params.delete("client");
      params.delete("dialog");
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function changeTab(tab: AdminTab) {
    router.push(buildUrl({ tab, clientId: null, dialog: null }), { scroll: false });
  }

  function openAddClientDialog() {
    router.push(buildUrl({ tab: "clients", ticketId: null, clientId: null, dialog: "add-client" }), {
      scroll: false
    });
  }

  function closeAddClientDialog() {
    router.push(buildUrl({ tab: "clients", ticketId: null, clientId: null, dialog: null }), {
      scroll: false
    });
  }

  function openTicket(ticketId: number) {
    router.push(buildUrl({ tab: "tickets", ticketId, clientId: null, dialog: null }), {
      scroll: false
    });
  }

  function closeTicket() {
    router.push(buildUrl({ tab: "tickets", ticketId: null, clientId: null, dialog: null }), {
      scroll: false
    });
  }

  function openClient(clientId: number) {
    router.push(buildUrl({ tab: "clients", ticketId: null, clientId, dialog: null }), { scroll: false });
  }

  function closeClient() {
    router.push(buildUrl({ tab: "clients", ticketId: null, clientId: null, dialog: null }), {
      scroll: false
    });
  }

  const ticketsTabUrl = buildUrl({ tab: "tickets", ticketId: null, clientId: null, dialog: null });
  const selectedTicketUrl = selectedTicket
    ? buildUrl({ tab: "tickets", ticketId: selectedTicket.id, clientId: null, dialog: null })
    : ticketsTabUrl;
  const clientsTabUrl = buildUrl({ tab: "clients", ticketId: null, clientId: null, dialog: null });
  const addClientErrorUrl = buildUrl({
    tab: "clients",
    ticketId: null,
    clientId: null,
    dialog: "add-client"
  });

  return (
    <>
      <section className="panel admin-dashboard">
        <div className="admin-dashboard__toolbar">
          <div aria-label="Admin dashboard tabs" className="admin-dashboard__tabs" role="tablist">
            {ADMIN_TABS.map((tab) => {
              const isActive = tab.id === activeTab;

              return (
                <button
                  aria-controls={`admin-tab-panel-${tab.id}`}
                  aria-selected={isActive}
                  className={`admin-dashboard__tab${isActive ? " admin-dashboard__tab--active" : ""}`}
                  id={`admin-tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => changeTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "clients" ? (
            <button className="button button-primary button-sm" onClick={openAddClientDialog} type="button">
              Add client
            </button>
          ) : null}
        </div>

        <div
          aria-labelledby={`admin-tab-${activeTab}`}
          className="admin-dashboard__content"
          id={`admin-tab-panel-${activeTab}`}
          role="tabpanel"
        >
          {activeTab === "tickets" ? (
            <div className="admin-section-stack">
              <section className="admin-tab-section">
                <div className="panel__header admin-tab-section__header">
                  <div>
                    <h2 className="panel__title">Open Tickets</h2>
                    <p className="admin-tab-section__copy">Review, prioritize, and update active work.</p>
                  </div>
                  <span className="panel__count">{data.openTickets.length}</span>
                </div>

                {data.openTickets.length === 0 ? (
                  <div className="empty-state">
                    <h3>No active tickets</h3>
                    <p>New client submissions will appear here.</p>
                  </div>
                ) : (
                  <div className="admin-ticket-grid">
                    {data.openTickets.map((ticket) => (
                      <button
                        className={`admin-ticket-card${
                          selectedTicket?.id === ticket.id ? " admin-ticket-card--active" : ""
                        }`}
                        key={ticket.id}
                        onClick={() => openTicket(ticket.id)}
                        type="button"
                      >
                        <div className="ticket-card__top">
                          <div className="ticket-card__badges">
                            <StatusBadge status={ticket.status} />
                            <PriorityBadge priority={ticket.priority} />
                          </div>
                          <span className="ticket-card__client">
                            {ticket.clientCompanyName || ticket.clientName}
                          </span>
                        </div>

                        <div className="ticket-card__body">
                          <h3 className="ticket-card__title">{ticket.title}</h3>
                          <p className="ticket-card__project">
                            {ticket.projectName} · {ticket.clientEmail}
                          </p>
                          <p className="ticket-card__description admin-ticket-card__description">
                            {ticket.description}
                          </p>
                        </div>

                        <div className="admin-ticket-card__footer">
                          <div className="ticket-card__meta">
                            <span>Updated {formatDateTime(ticket.updatedAt)}</span>
                          </div>
                          <span className="admin-ticket-card__count">
                            {ticket.comments.length} comments
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="admin-tab-section">
                <div className="panel__header admin-tab-section__header">
                  <div>
                    <h2 className="panel__title">Completed Tickets</h2>
                    <p className="admin-tab-section__copy">Closed work ordered by the latest completion time.</p>
                  </div>
                  <span className="panel__count">{data.completedTickets.length}</span>
                </div>

                {data.completedTickets.length === 0 ? (
                  <div className="empty-state">
                    <p>Completed tickets will appear here after clients approve them.</p>
                  </div>
                ) : (
                  <div className="ticket-table-shell">
                    <table className="ticket-table">
                      <thead>
                        <tr>
                          <th scope="col">Ticket</th>
                          <th scope="col">Client</th>
                          <th scope="col">Priority</th>
                          <th scope="col">Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.completedTickets.map((ticket) => (
                          <tr key={ticket.id}>
                            <td data-label="Ticket">
                              <div className="ticket-table__title-wrap">
                                <span className="ticket-table__title">{ticket.title}</span>
                                <span className="ticket-table__sub">{ticket.projectName}</span>
                              </div>
                            </td>
                            <td data-label="Client">{ticket.clientCompanyName || ticket.clientName}</td>
                            <td data-label="Priority">
                              <PriorityBadge priority={ticket.priority} />
                            </td>
                            <td data-label="Completed">{formatDateTime(ticket.completedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === "clients" ? (
            <section className="admin-tab-section">
              <div className="panel__header admin-tab-section__header">
                <div>
                  <h2 className="panel__title">Client Roster</h2>
                  <p className="admin-tab-section__copy">Open a client to review their projects or add a new one.</p>
                </div>
                <span className="panel__count">{data.clients.length}</span>
              </div>

              {data.clients.length === 0 ? (
                <div className="empty-state">
                  <h3>No clients yet</h3>
                  <p>Create the first client account to start tracking work.</p>
                </div>
              ) : (
                <div className="ticket-table-shell">
                  <table className="ticket-table admin-roster-table">
                    <thead>
                      <tr>
                        <th scope="col">Client</th>
                        <th scope="col">Email</th>
                        <th scope="col">Projects</th>
                        <th scope="col">Tickets</th>
                        <th scope="col">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.clients.map((client) => (
                        <tr
                          className="ticket-table__row"
                          key={client.id}
                          onClick={() => openClient(client.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openClient(client.id);
                            }
                          }}
                          tabIndex={0}
                        >
                          <td data-label="Client">
                            <div className="ticket-table__title-wrap">
                              <span className="ticket-table__title">{client.companyName || client.name}</span>
                              <span className="ticket-table__sub">{client.name}</span>
                            </div>
                          </td>
                          <td data-label="Email">{client.email}</td>
                          <td data-label="Projects">{client.projectCount}</td>
                          <td data-label="Tickets">{client.ticketCount}</td>
                          <td data-label="Open">{client.outstandingCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "overview" ? (
            <section className="admin-tab-section">
              <div className="panel__header admin-tab-section__header">
                <div>
                  <h2 className="panel__title">Overview Statistics</h2>
                  <p className="admin-tab-section__copy">A high-level snapshot of the current workload.</p>
                </div>
              </div>

              <div className="stats-grid admin-overview-grid">
                <article className="stat-card">
                  <span className="stat-card__label">Clients</span>
                  <span className="stat-card__value">{data.totalClients}</span>
                </article>
                <article className="stat-card">
                  <span className="stat-card__label">Projects</span>
                  <span className="stat-card__value">{data.totalProjects}</span>
                </article>
                <article className="stat-card">
                  <span className="stat-card__label">Open tickets</span>
                  <span className="stat-card__value">{data.totalOpenTickets}</span>
                </article>
                <article className="stat-card">
                  <span className="stat-card__label">In review</span>
                  <span className="stat-card__value">{data.totalReviewTickets}</span>
                </article>
              </div>
            </section>
          ) : null}
        </div>
      </section>

      {isMounted && activeTab === "tickets" && selectedTicket
        ? createPortal(
            <div className="modal-backdrop" onClick={closeTicket} role="presentation">
              <div
                aria-labelledby={`admin-ticket-title-${selectedTicket.id}`}
                aria-modal="true"
                className="ticket-modal admin-ticket-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
              >
                <div className="admin-ticket-modal__header">
                  <div>
                    <p className="ticket-modal__eyebrow">
                      Ticket {selectedTicketIndex + 1} of {data.openTickets.length}
                    </p>
                    <h3 id={`admin-ticket-title-${selectedTicket.id}`}>{selectedTicket.title}</h3>
                    <p className="admin-modal-subtitle">
                      {(selectedTicket.clientCompanyName || selectedTicket.clientName) +
                        " · " +
                        selectedTicket.projectName +
                        " · " +
                        selectedTicket.clientEmail}
                    </p>
                  </div>

                  <div className="admin-ticket-modal__controls">
                    <button
                      className="button button-secondary button-sm"
                      disabled={!previousTicket}
                      onClick={() => previousTicket && openTicket(previousTicket.id)}
                      type="button"
                    >
                      Previous
                    </button>
                    <button
                      className="button button-secondary button-sm"
                      disabled={!nextTicket}
                      onClick={() => nextTicket && openTicket(nextTicket.id)}
                      type="button"
                    >
                      Next
                    </button>
                    <button
                      aria-label="Close ticket details"
                      className="ticket-modal__close"
                      onClick={closeTicket}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="admin-ticket-modal__body">
                  <div className="admin-ticket-modal__grid">
                    <div className="admin-ticket-modal__main">
                      <div className="ticket-modal__badges">
                        <StatusBadge status={selectedTicket.status} />
                        <PriorityBadge priority={selectedTicket.priority} />
                      </div>

                        <div className="ticket-modal__meta-grid">
                        <div className="ticket-modal__meta-card">
                          <span>Created</span>
                          <strong>{formatDateTime(selectedTicket.createdAt)}</strong>
                        </div>
                        <div className="ticket-modal__meta-card">
                          <span>Updated</span>
                          <strong>{formatDateTime(selectedTicket.updatedAt)}</strong>
                        </div>
                        <div className="ticket-modal__meta-card">
                          <span>Status</span>
                          <strong>{formatStatusLabel(selectedTicket.status)}</strong>
                        </div>
                        <div className="ticket-modal__meta-card">
                          <span>Comments</span>
                          <strong>{selectedTicket.comments.length}</strong>
                        </div>
                      </div>

                      <section className="ticket-modal__section">
                        <h4>Description</h4>
                        <p className="ticket-modal__copy">{selectedTicket.description}</p>
                      </section>

                      {selectedTicket.resolutionSummary ? (
                        <section className="ticket-modal__section">
                          <h4>Current review summary</h4>
                          <p className="ticket-modal__copy">{selectedTicket.resolutionSummary}</p>
                        </section>
                      ) : null}

                      <section className="ticket-modal__section">
                        <div className="ticket-modal__section-header">
                          <h4>Comments</h4>
                          <span>{selectedTicket.comments.length}</span>
                        </div>

                        {selectedTicket.comments.length === 0 ? (
                          <div className="ticket-modal__empty">
                            <p>No comments on this ticket yet.</p>
                          </div>
                        ) : (
                          <div className="ticket-comment-list">
                            {selectedTicket.comments.map((comment) => (
                              <article className="ticket-comment" key={comment.id}>
                                <div className="ticket-comment__top">
                                  <strong>{comment.authorName}</strong>
                                  <span>{formatDateTime(comment.createdAt)}</span>
                                </div>
                                <p>{comment.body}</p>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>

                    <aside className="admin-ticket-modal__sidebar">
                      <section className="ticket-modal__section admin-ticket-modal__editor">
                        <h4>Update ticket</h4>
                        <form action={updateTicketAction} className="stack-form">
                          <input name="ticketId" type="hidden" value={selectedTicket.id} />
                          <input name="redirectTo" type="hidden" value={selectedTicketUrl} />
                          <input name="errorRedirectTo" type="hidden" value={selectedTicketUrl} />

                          <div className="ticket-form__row">
                            <label className="field">
                              <span>Status</span>
                              <select name="status" defaultValue={selectedTicket.status}>
                                <option value="NOT_STARTED">Not started</option>
                                <option value="IN_PROGRESS">In progress</option>
                                <option value="CLIENT_REVIEW">Client review</option>
                                <option value="DONE">Done</option>
                              </select>
                            </label>

                            <label className="field">
                              <span>Priority</span>
                              <select name="priority" defaultValue={selectedTicket.priority}>
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                              </select>
                            </label>
                          </div>

                          <label className="field">
                            <span>Client review summary</span>
                            <textarea
                              defaultValue={selectedTicket.resolutionSummary || ""}
                              name="resolutionSummary"
                              placeholder="Describe what was completed before sending into client review."
                              rows={6}
                            />
                          </label>

                          <label className="field">
                            <span>Admin notes</span>
                            <textarea
                              defaultValue={selectedTicket.adminNotes || ""}
                              name="adminNotes"
                              placeholder="Internal context, next steps, or follow-up notes."
                              rows={6}
                            />
                          </label>

                          <SubmitButton label="Save changes" pendingLabel="Saving..." />
                        </form>
                      </section>
                    </aside>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {isMounted && activeDialog === "add-client"
        ? createPortal(
            <div className="modal-backdrop" onClick={closeAddClientDialog} role="presentation">
              <div
                aria-labelledby="add-client-title"
                aria-modal="true"
                className="ticket-modal admin-dialog admin-dialog--narrow"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
              >
                <div className="ticket-modal__header">
                  <div>
                    <p className="ticket-modal__eyebrow">New client</p>
                    <h3 id="add-client-title">Create client account</h3>
                    <p className="admin-modal-subtitle">
                      Add a client record and a temporary password they can use to sign in.
                    </p>
                  </div>
                  <button
                    aria-label="Close add client dialog"
                    className="ticket-modal__close"
                    onClick={closeAddClientDialog}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                <form action={createClientAction} className="stack-form">
                  <input name="redirectTo" type="hidden" value={clientsTabUrl} />
                  <input name="errorRedirectTo" type="hidden" value={addClientErrorUrl} />

                  <div className="admin-modal-form-grid">
                    <label className="field">
                      <span>Name</span>
                      <input name="name" placeholder="Jane Smith" required />
                    </label>
                    <label className="field">
                      <span>Company</span>
                      <input name="companyName" placeholder="Acme Studio" required />
                    </label>
                  </div>

                  <label className="field">
                    <span>Email</span>
                    <input name="email" placeholder="jane@acme.com" required type="email" />
                  </label>

                  <label className="field">
                    <span>Temporary password</span>
                    <input name="password" placeholder="Strong password" required type="text" />
                  </label>

                  <SubmitButton label="Create client" pendingLabel="Creating..." />
                </form>
              </div>
            </div>,
            document.body
          )
        : null}

      {isMounted && activeDialog !== "add-client" && selectedClient
        ? createPortal(
            <div className="modal-backdrop" onClick={closeClient} role="presentation">
              <div
                aria-labelledby={`client-modal-title-${selectedClient.id}`}
                aria-modal="true"
                className="ticket-modal admin-dialog"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
              >
                <div className="ticket-modal__header">
                  <div>
                    <p className="ticket-modal__eyebrow">Client profile</p>
                    <h3 id={`client-modal-title-${selectedClient.id}`}>
                      {selectedClient.companyName || selectedClient.name}
                    </h3>
                    <p className="admin-modal-subtitle">
                      {selectedClient.name} · {selectedClient.email}
                    </p>
                  </div>
                  <button
                    aria-label="Close client details"
                    className="ticket-modal__close"
                    onClick={closeClient}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                <div className="ticket-modal__meta-grid">
                  <div className="ticket-modal__meta-card">
                    <span>Projects</span>
                    <strong>{selectedClient.projectCount}</strong>
                  </div>
                  <div className="ticket-modal__meta-card">
                    <span>Tickets</span>
                    <strong>{selectedClient.ticketCount}</strong>
                  </div>
                  <div className="ticket-modal__meta-card">
                    <span>Open tickets</span>
                    <strong>{selectedClient.outstandingCount}</strong>
                  </div>
                  <div className="ticket-modal__meta-card">
                    <span>Email</span>
                    <strong>{selectedClient.email}</strong>
                  </div>
                </div>

                <section className="ticket-modal__section">
                  <div className="ticket-modal__section-header">
                    <h4>Projects</h4>
                    <span>{selectedClientProjects.length}</span>
                  </div>

                  {selectedClientProjects.length === 0 ? (
                    <div className="ticket-modal__empty">
                      <p>No projects have been created for this client yet.</p>
                    </div>
                  ) : (
                    <div className="admin-project-list">
                      {selectedClientProjects.map((project) => (
                        <article className="admin-project-card" key={project.id}>
                          <div className="admin-project-card__header">
                            <div>
                              <h4>{project.name}</h4>
                              <p>{project.description || "No project description yet."}</p>
                            </div>
                            <dl className="admin-project-card__stats">
                              <div>
                                <dt>Tickets</dt>
                                <dd>{project.ticketCount}</dd>
                              </div>
                              <div>
                                <dt>Open</dt>
                                <dd>{project.openTicketCount}</dd>
                              </div>
                            </dl>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="ticket-modal__section">
                  <h4>Add Project</h4>
                  <form action={createProjectAction} className="stack-form">
                    <input name="clientId" type="hidden" value={selectedClient.id} />
                    <input
                      name="redirectTo"
                      type="hidden"
                      value={buildUrl({ tab: "clients", clientId: selectedClient.id, dialog: null })}
                    />
                    <input
                      name="errorRedirectTo"
                      type="hidden"
                      value={buildUrl({ tab: "clients", clientId: selectedClient.id, dialog: null })}
                    />

                    <label className="field">
                      <span>Project name</span>
                      <input name="name" placeholder="Website retainer" required />
                    </label>

                    <label className="field">
                      <span>Description</span>
                      <textarea
                        name="description"
                        placeholder="Optional project context or scope notes."
                        rows={4}
                      />
                    </label>

                    <SubmitButton label="Create project" pendingLabel="Saving..." />
                  </form>
                </section>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
