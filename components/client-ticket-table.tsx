"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

import { addTicketCommentAction } from "@/app/actions";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import type { TicketSummary } from "@/lib/types";
import { formatDateTime, formatPriorityLabel, formatStatusLabel } from "@/lib/utils";

interface ClientTicketTableProps {
  tickets: TicketSummary[];
}

export function ClientTicketTable({ tickets }: ClientTicketTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const selectedTicketId = Number.parseInt(searchParams.get("ticket") || "", 10);
  const selectedTicket = Number.isFinite(selectedTicketId)
    ? tickets.find((ticket) => ticket.id === selectedTicketId) ?? null
    : null;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function buildUrl(ticketId: number | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (ticketId) {
      params.set("ticket", String(ticketId));
    } else {
      params.delete("ticket");
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function openTicket(ticketId: number) {
    router.push(buildUrl(ticketId), { scroll: false });
  }

  function closeTicket() {
    router.push(buildUrl(null), { scroll: false });
  }

  useEffect(() => {
    if (!selectedTicket) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeTicket();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTicket]);

  return (
    <>
      <div className="ticket-table-shell">
        <table className="ticket-table">
          <thead>
            <tr>
              <th scope="col">Ticket</th>
              <th scope="col">Status</th>
              <th scope="col">Priority</th>
              <th scope="col">Comments</th>
              <th scope="col">Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr
                className="ticket-table__row"
                key={ticket.id}
                onClick={() => openTicket(ticket.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openTicket(ticket.id);
                  }
                }}
                tabIndex={0}
              >
                <td data-label="Ticket">
                  <div className="ticket-table__title-wrap">
                    <span className="ticket-table__title">{ticket.title}</span>
                    <span className="ticket-table__sub">
                      {ticket.projectName} · Created {formatDateTime(ticket.createdAt)}
                    </span>
                  </div>
                </td>
                <td data-label="Status">
                  <StatusBadge status={ticket.status} />
                </td>
                <td data-label="Priority">
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td data-label="Comments">{ticket.comments.length}</td>
                <td data-label="Updated">{formatDateTime(ticket.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isMounted && selectedTicket
        ? createPortal(
            <div className="modal-backdrop" onClick={closeTicket} role="presentation">
              <div
                aria-labelledby={`ticket-modal-title-${selectedTicket.id}`}
                aria-modal="true"
                className="ticket-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
              >
                <div className="ticket-modal__header">
                  <div>
                    <p className="ticket-modal__eyebrow">{selectedTicket.projectName}</p>
                    <h3 id={`ticket-modal-title-${selectedTicket.id}`}>{selectedTicket.title}</h3>
                  </div>
                  <button
                    aria-label="Close ticket details"
                    className="ticket-modal__close"
                    onClick={closeTicket}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                <div className="ticket-modal__badges">
                  <StatusBadge status={selectedTicket.status} />
                  <PriorityBadge priority={selectedTicket.priority} />
                </div>

                <div className="ticket-modal__meta-grid">
                  <div className="ticket-modal__meta-card">
                    <span>Status</span>
                    <strong>{formatStatusLabel(selectedTicket.status)}</strong>
                  </div>
                  <div className="ticket-modal__meta-card">
                    <span>Priority</span>
                    <strong>{formatPriorityLabel(selectedTicket.priority)}</strong>
                  </div>
                  <div className="ticket-modal__meta-card">
                    <span>Created</span>
                    <strong>{formatDateTime(selectedTicket.createdAt)}</strong>
                  </div>
                  <div className="ticket-modal__meta-card">
                    <span>Updated</span>
                    <strong>{formatDateTime(selectedTicket.updatedAt)}</strong>
                  </div>
                </div>

                <section className="ticket-modal__section">
                  <h4>Description</h4>
                  <p className="ticket-modal__copy">{selectedTicket.description}</p>
                </section>

                {selectedTicket.resolutionSummary ? (
                  <section className="ticket-modal__section">
                    <h4>Completion Summary</h4>
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
                      <p>No comments yet.</p>
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

                <section className="ticket-modal__section">
                  <h4>Add Comment</h4>
                  <form action={addTicketCommentAction} className="stack-form">
                    <input name="ticketId" type="hidden" value={selectedTicket.id} />
                    <input name="redirectTo" type="hidden" value={buildUrl(selectedTicket.id)} />
                    <label className="field">
                      <span>Comment</span>
                      <textarea
                        name="body"
                        placeholder="Add context, questions, or approval notes for this ticket."
                        required
                        rows={4}
                      />
                    </label>
                    <SubmitButton label="Add comment" pendingLabel="Saving..." />
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
