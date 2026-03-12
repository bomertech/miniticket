import type { TicketStatus } from "@/lib/types";
import { formatStatusLabel } from "@/lib/utils";

const statusClasses: Record<TicketStatus, string> = {
  NOT_STARTED: "badge badge-not-started",
  IN_PROGRESS: "badge badge-in-progress",
  CLIENT_REVIEW: "badge badge-client-review",
  DONE: "badge badge-done"
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={statusClasses[status]}>
      <span className="badge-dot" />
      {formatStatusLabel(status)}
    </span>
  );
}
