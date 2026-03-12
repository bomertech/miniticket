import type { TicketPriority } from "@/lib/types";
import { formatPriorityLabel } from "@/lib/utils";

const priorityClasses: Record<TicketPriority, string> = {
  LOW: "badge badge-low",
  MEDIUM: "badge badge-medium",
  HIGH: "badge badge-high",
  URGENT: "badge badge-urgent"
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={priorityClasses[priority]}>{formatPriorityLabel(priority)}</span>;
}
