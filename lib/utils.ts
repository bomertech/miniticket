import type { TicketPriority, TicketStatus } from "@/lib/types";

export function getBaseUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

export function nowIso() {
  return new Date().toISOString();
}

export function addHours(date: Date, hours: number) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result.toISOString();
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString();
}

export function parseIntStrict(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string") {
    return Number.NaN;
  }

  return Number.parseInt(value, 10);
}

export function isTicketStatus(value: string): value is TicketStatus {
  return ["NOT_STARTED", "IN_PROGRESS", "CLIENT_REVIEW", "DONE"].includes(value);
}

export function isTicketPriority(value: string): value is TicketPriority {
  return ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(value);
}

export function formatStatusLabel(status: TicketStatus) {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "IN_PROGRESS":
      return "In progress";
    case "CLIENT_REVIEW":
      return "Client review";
    case "DONE":
      return "Done";
    default:
      return status;
  }
}

export function formatPriorityLabel(priority: TicketPriority) {
  switch (priority) {
    case "LOW":
      return "Low";
    case "MEDIUM":
      return "Medium";
    case "HIGH":
      return "High";
    case "URGENT":
      return "Urgent";
    default:
      return priority;
  }
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function encodeMessage(message: string) {
  return encodeURIComponent(message);
}
