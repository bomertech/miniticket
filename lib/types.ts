export const USER_ROLES = ["ADMIN", "CLIENT"] as const;
export const TICKET_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "CLIENT_REVIEW",
  "DONE"
] as const;
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  companyName: string | null;
  role: UserRole;
}

export interface ClientSummary {
  id: number;
  name: string;
  email: string;
  companyName: string | null;
  projectCount: number;
  ticketCount: number;
  outstandingCount: number;
}

export interface ProjectSummary {
  id: number;
  clientId: number;
  clientName: string;
  name: string;
  description: string | null;
  ticketCount: number;
  openTicketCount: number;
}

export interface TicketSummary {
  id: number;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  resolutionSummary: string | null;
  adminNotes: string | null;
  clientReviewRequestedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastStatusChangedAt: string;
  projectId: number;
  projectName: string;
  clientId: number;
  clientName: string;
  clientEmail: string;
  clientCompanyName: string | null;
  comments: TicketComment[];
}

export interface TicketComment {
  id: number;
  ticketId: number;
  authorName: string;
  authorRole: UserRole;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDashboardData {
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  tickets: TicketSummary[];
  totalTickets: number;
  openTickets: number;
  reviewTickets: number;
}

export interface AdminDashboardData {
  clients: ClientSummary[];
  projects: ProjectSummary[];
  openTickets: TicketSummary[];
  completedTickets: TicketSummary[];
  totalClients: number;
  totalProjects: number;
  totalOpenTickets: number;
  totalReviewTickets: number;
}

export interface ReviewRequestContext {
  ticketId: number;
  ticketTitle: string;
  projectName: string;
  clientName: string;
  resolutionSummary: string | null;
  expiresAt: string;
  status: TicketStatus;
}
