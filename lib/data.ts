import { getDb, writeAuditEntry } from "@/lib/db";
import { getBaseUrl, addHours, isTicketPriority, isTicketStatus, nowIso } from "@/lib/utils";
import { createToken, hashPassword, hashToken } from "@/lib/security";
import type {
  AdminDashboardData,
  ClientDashboardData,
  ClientSummary,
  ProjectSummary,
  ReviewRequestContext,
  TicketComment,
  TicketPriority,
  TicketStatus,
  TicketSummary
} from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type TicketRow = Omit<TicketSummary, "comments">;

function requireText(value: string, label: string, minimumLength = 1) {
  const trimmed = value.trim();

  if (trimmed.length < minimumLength) {
    throw new Error(`${label} is required.`);
  }

  return trimmed;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalized)) {
    throw new Error("Please enter a valid email address.");
  }

  return normalized;
}

function assertPassword(password: string) {
  if (password.length < 8) {
    throw new Error("Passwords must be at least 8 characters.");
  }

  return password;
}

function mapTicketRows(rows: TicketRow[]) {
  if (rows.length === 0) {
    return [];
  }

  const db = getDb();
  const placeholders = rows.map(() => "?").join(", ");
  const commentRows = db
    .prepare(`
      SELECT
        id,
        ticket_id AS ticketId,
        author_name AS authorName,
        author_role AS authorRole,
        body,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM ticket_comments
      WHERE ticket_id IN (${placeholders})
      ORDER BY created_at ASC, id ASC
    `)
    .all(...rows.map((row) => row.id)) as TicketComment[];

  const commentsByTicketId = new Map<number, TicketComment[]>();

  for (const comment of commentRows) {
    const comments = commentsByTicketId.get(comment.ticketId) ?? [];
    comments.push(comment);
    commentsByTicketId.set(comment.ticketId, comments);
  }

  return rows.map((row) => ({
    ...row,
    comments: commentsByTicketId.get(row.id) ?? []
  }));
}

function getTicketOrderClause() {
  return `
    CASE t.status
      WHEN 'CLIENT_REVIEW' THEN 1
      WHEN 'IN_PROGRESS' THEN 2
      WHEN 'NOT_STARTED' THEN 3
      ELSE 4
    END,
    CASE t.priority
      WHEN 'URGENT' THEN 1
      WHEN 'HIGH' THEN 2
      WHEN 'MEDIUM' THEN 3
      ELSE 4
    END,
    t.updated_at DESC
  `;
}

export function getAdminRecipients() {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT email
      FROM users
      WHERE role = 'ADMIN'
        AND is_active = 1
      ORDER BY id ASC
    `)
    .all() as Array<{ email: string }>;

  if (rows.length > 0) {
    return rows.map((row) => row.email);
  }

  return process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : [];
}

export function getClientDashboardData(clientId: number, selectedProjectId?: number | null): ClientDashboardData {
  const db = getDb();
  const projects = db
    .prepare(`
      SELECT
        p.id,
        p.client_id AS clientId,
        u.name AS clientName,
        p.name,
        p.description,
        (
          SELECT COUNT(*)
          FROM tickets t
          WHERE t.project_id = p.id
        ) AS ticketCount,
        (
          SELECT COUNT(*)
          FROM tickets t
          WHERE t.project_id = p.id
            AND t.status != 'DONE'
        ) AS openTicketCount
      FROM projects p
      INNER JOIN users u ON u.id = p.client_id
      WHERE p.client_id = ?
        AND p.is_active = 1
      ORDER BY p.name COLLATE NOCASE ASC
    `)
    .all(clientId) as ProjectSummary[];

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;

  const tickets = selectedProject
    ? (db
        .prepare(`
          SELECT
            t.id,
            t.title,
            t.description,
            t.priority,
            t.status,
            t.resolution_summary AS resolutionSummary,
            t.admin_notes AS adminNotes,
            t.client_review_requested_at AS clientReviewRequestedAt,
            t.completed_at AS completedAt,
            t.created_at AS createdAt,
            t.updated_at AS updatedAt,
            t.last_status_changed_at AS lastStatusChangedAt,
            p.id AS projectId,
            p.name AS projectName,
            u.id AS clientId,
            u.name AS clientName,
            u.email AS clientEmail,
            u.company_name AS clientCompanyName
          FROM tickets t
          INNER JOIN projects p ON p.id = t.project_id
          INNER JOIN users u ON u.id = t.client_id
          WHERE t.client_id = ?
            AND t.project_id = ?
          ORDER BY ${getTicketOrderClause()}
        `)
        .all(clientId, selectedProject.id) as TicketRow[])
    : [];

  return {
    projects,
    selectedProject,
    tickets: mapTicketRows(tickets),
    totalTickets: tickets.length,
    openTickets: tickets.filter((ticket) => ticket.status !== "DONE").length,
    reviewTickets: tickets.filter((ticket) => ticket.status === "CLIENT_REVIEW").length
  };
}

export function getAdminDashboardData(): AdminDashboardData {
  const db = getDb();
  const clients = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.company_name AS companyName,
        (
          SELECT COUNT(*)
          FROM projects p
          WHERE p.client_id = u.id
            AND p.is_active = 1
        ) AS projectCount,
        (
          SELECT COUNT(*)
          FROM tickets t
          WHERE t.client_id = u.id
        ) AS ticketCount,
        (
          SELECT COUNT(*)
          FROM tickets t
          WHERE t.client_id = u.id
            AND t.status != 'DONE'
        ) AS outstandingCount
      FROM users u
      WHERE u.role = 'CLIENT'
        AND u.is_active = 1
      ORDER BY outstandingCount DESC, u.name COLLATE NOCASE ASC
    `)
    .all() as ClientSummary[];

  const projects = db
    .prepare(`
      SELECT
        p.id,
        p.client_id AS clientId,
        u.name AS clientName,
        p.name,
        p.description,
        (
          SELECT COUNT(*)
          FROM tickets t
          WHERE t.project_id = p.id
        ) AS ticketCount,
        (
          SELECT COUNT(*)
          FROM tickets t
          WHERE t.project_id = p.id
            AND t.status != 'DONE'
        ) AS openTicketCount
      FROM projects p
      INNER JOIN users u ON u.id = p.client_id
      WHERE p.is_active = 1
      ORDER BY u.name COLLATE NOCASE ASC, p.name COLLATE NOCASE ASC
    `)
    .all() as ProjectSummary[];

  const openTickets = db
    .prepare(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.priority,
        t.status,
        t.resolution_summary AS resolutionSummary,
        t.admin_notes AS adminNotes,
        t.client_review_requested_at AS clientReviewRequestedAt,
        t.completed_at AS completedAt,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt,
        t.last_status_changed_at AS lastStatusChangedAt,
        p.id AS projectId,
        p.name AS projectName,
        u.id AS clientId,
        u.name AS clientName,
        u.email AS clientEmail,
        u.company_name AS clientCompanyName
      FROM tickets t
      INNER JOIN projects p ON p.id = t.project_id
      INNER JOIN users u ON u.id = t.client_id
      WHERE t.status != 'DONE'
      ORDER BY ${getTicketOrderClause()}
    `)
    .all() as TicketRow[];

  const completedTickets = db
    .prepare(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.priority,
        t.status,
        t.resolution_summary AS resolutionSummary,
        t.admin_notes AS adminNotes,
        t.client_review_requested_at AS clientReviewRequestedAt,
        t.completed_at AS completedAt,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt,
        t.last_status_changed_at AS lastStatusChangedAt,
        p.id AS projectId,
        p.name AS projectName,
        u.id AS clientId,
        u.name AS clientName,
        u.email AS clientEmail,
        u.company_name AS clientCompanyName
      FROM tickets t
      INNER JOIN projects p ON p.id = t.project_id
      INNER JOIN users u ON u.id = t.client_id
      WHERE t.status = 'DONE'
      ORDER BY t.completed_at DESC
    `)
    .all() as TicketRow[];

  return {
    clients,
    projects,
    openTickets: mapTicketRows(openTickets),
    completedTickets: mapTicketRows(completedTickets),
    totalClients: clients.length,
    totalProjects: projects.length,
    totalOpenTickets: openTickets.length,
    totalReviewTickets: openTickets.filter((ticket) => ticket.status === "CLIENT_REVIEW").length
  };
}

export function createClientUser(input: {
  name: string;
  email: string;
  companyName: string;
  password: string;
}) {
  const db = getDb();
  const name = requireText(input.name, "Client name", 2);
  const companyName = requireText(input.companyName, "Company name", 2);
  const email = assertEmail(input.email);
  const password = assertPassword(input.password);

  const existingUser = db
    .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
    .get(email) as { id: number } | undefined;

  if (existingUser) {
    throw new Error("A user with that email already exists.");
  }

  const timestamp = nowIso();
  const result = db
    .prepare(`
      INSERT INTO users (role, name, email, password_hash, company_name, is_active, created_at, updated_at)
      VALUES ('CLIENT', ?, ?, ?, ?, 1, ?, ?)
    `)
    .run(name, email, hashPassword(password), companyName, timestamp, timestamp);

  return Number(result.lastInsertRowid);
}

export function createProjectForClient(input: {
  clientId: number;
  name: string;
  description: string;
}) {
  const db = getDb();
  const clientId = input.clientId;
  const name = requireText(input.name, "Project name", 2);
  const description = optionalText(input.description);
  const timestamp = nowIso();

  const client = db
    .prepare(`
      SELECT id
      FROM users
      WHERE id = ?
        AND role = 'CLIENT'
        AND is_active = 1
      LIMIT 1
    `)
    .get(clientId) as { id: number } | undefined;

  if (!client) {
    throw new Error("Select a valid client before creating a project.");
  }

  const existingProject = db
    .prepare(`
      SELECT id
      FROM projects
      WHERE client_id = ?
        AND LOWER(name) = LOWER(?)
      LIMIT 1
    `)
    .get(clientId, name) as { id: number } | undefined;

  if (existingProject) {
    throw new Error("That client already has a project with this name.");
  }

  const result = db
    .prepare(`
      INSERT INTO projects (client_id, name, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `)
    .run(clientId, name, description, timestamp, timestamp);

  return Number(result.lastInsertRowid);
}

export function createTicketForClient(input: {
  clientId: number;
  projectId: number;
  title: string;
  description: string;
  priority: TicketPriority;
}) {
  const db = getDb();
  const title = requireText(input.title, "Ticket title", 3);
  const description = requireText(input.description, "Ticket description", 10);

  if (!isTicketPriority(input.priority)) {
    throw new Error("Please choose a valid priority.");
  }

  const project = db
    .prepare(`
      SELECT
        p.id,
        p.name,
        u.name AS clientName,
        u.email AS clientEmail
      FROM projects p
      INNER JOIN users u ON u.id = p.client_id
      WHERE p.id = ?
        AND p.client_id = ?
        AND p.is_active = 1
      LIMIT 1
    `)
    .get(input.projectId, input.clientId) as
    | {
        id: number;
        name: string;
        clientName: string;
        clientEmail: string;
      }
    | undefined;

  if (!project) {
    throw new Error("Choose one of your active projects before creating a ticket.");
  }

  const createTicketTransaction = db.transaction(() => {
    const timestamp = nowIso();
    const result = db
      .prepare(`
        INSERT INTO tickets (
          project_id,
          client_id,
          title,
          description,
          priority,
          status,
          resolution_summary,
          admin_notes,
          client_review_requested_at,
          client_review_email_sent_at,
          completed_at,
          created_at,
          updated_at,
          last_status_changed_at
        )
        VALUES (?, ?, ?, ?, ?, 'NOT_STARTED', NULL, NULL, NULL, NULL, NULL, ?, ?, ?)
      `)
      .run(
        input.projectId,
        input.clientId,
        title,
        description,
        input.priority,
        timestamp,
        timestamp,
        timestamp
      );

    const ticketId = Number(result.lastInsertRowid);

    writeAuditEntry(ticketId, project.clientName, "ticket_created", "Ticket created by client.");

    return {
      id: ticketId,
      projectName: project.name,
      clientName: project.clientName,
      clientEmail: project.clientEmail,
      title,
      description,
      priority: input.priority
    };
  });

  return createTicketTransaction();
}

export function addTicketCommentByClient(input: {
  ticketId: number;
  clientId: number;
  actorName: string;
  body: string;
}) {
  const db = getDb();
  const body = requireText(input.body, "Comment", 1);
  const ticket = db
    .prepare(`
      SELECT
        t.id,
        t.title,
        p.name AS projectName
      FROM tickets t
      INNER JOIN projects p ON p.id = t.project_id
      WHERE t.id = ?
        AND t.client_id = ?
      LIMIT 1
    `)
    .get(input.ticketId, input.clientId) as
    | {
        id: number;
        title: string;
        projectName: string;
      }
    | undefined;

  if (!ticket) {
    throw new Error("That ticket could not be found.");
  }

  const addCommentTransaction = db.transaction(() => {
    const timestamp = nowIso();

    db.prepare(`
      INSERT INTO ticket_comments (
        ticket_id,
        author_id,
        author_name,
        author_role,
        body,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, 'CLIENT', ?, ?, ?)
    `).run(input.ticketId, input.clientId, input.actorName, body, timestamp, timestamp);

    db.prepare(`
      UPDATE tickets
      SET updated_at = ?
      WHERE id = ?
    `).run(timestamp, input.ticketId);

    writeAuditEntry(
      input.ticketId,
      input.actorName,
      "client_comment_added",
      "Client added a comment."
    );

    return {
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      projectName: ticket.projectName
    };
  });

  return addCommentTransaction();
}

export function updateTicketByAdmin(input: {
  ticketId: number;
  status: TicketStatus;
  priority: TicketPriority;
  resolutionSummary: string;
  adminNotes: string;
  actorName: string;
}) {
  if (!isTicketStatus(input.status)) {
    throw new Error("Please choose a valid ticket status.");
  }

  if (!isTicketPriority(input.priority)) {
    throw new Error("Please choose a valid ticket priority.");
  }

  const db = getDb();
  const currentTicket = db
    .prepare(`
      SELECT
        t.id,
        t.title,
        t.priority,
        t.status,
        t.resolution_summary AS resolutionSummary,
        t.admin_notes AS adminNotes,
        t.last_status_changed_at AS lastStatusChangedAt,
        t.client_review_requested_at AS clientReviewRequestedAt,
        t.client_review_email_sent_at AS clientReviewEmailSentAt,
        t.completed_at AS completedAt,
        p.name AS projectName,
        u.name AS clientName,
        u.email AS clientEmail
      FROM tickets t
      INNER JOIN projects p ON p.id = t.project_id
      INNER JOIN users u ON u.id = t.client_id
      WHERE t.id = ?
      LIMIT 1
    `)
    .get(input.ticketId) as
    | {
        id: number;
        title: string;
        priority: TicketPriority;
        status: TicketStatus;
        resolutionSummary: string | null;
        adminNotes: string | null;
        lastStatusChangedAt: string;
        clientReviewRequestedAt: string | null;
        clientReviewEmailSentAt: string | null;
        completedAt: string | null;
        projectName: string;
        clientName: string;
        clientEmail: string;
      }
    | undefined;

  if (!currentTicket) {
    throw new Error("That ticket no longer exists.");
  }

  const resolutionSummary = optionalText(input.resolutionSummary);
  const adminNotes = optionalText(input.adminNotes);

  if (input.status === "CLIENT_REVIEW" && !resolutionSummary) {
    throw new Error("Add the client review summary before moving a ticket into client review.");
  }

  const ticketTtlHours = Number(process.env.TICKET_REVIEW_TOKEN_TTL_HOURS || 336);
  const needsReviewEmail = currentTicket.status !== "CLIENT_REVIEW" && input.status === "CLIENT_REVIEW";

  const updateTicketTransaction = db.transaction(() => {
    const timestamp = nowIso();
    let approvalUrl: string | null = null;
    let replyTo: string | null = null;

    if (needsReviewEmail) {
      db.prepare("DELETE FROM approval_tokens WHERE ticket_id = ? AND used_at IS NULL").run(input.ticketId);

      const rawToken = createToken();
      db.prepare(`
        INSERT INTO approval_tokens (ticket_id, token_hash, expires_at, used_at, created_at)
        VALUES (?, ?, ?, NULL, ?)
      `).run(input.ticketId, hashToken(rawToken), addHours(new Date(), ticketTtlHours), timestamp);

      approvalUrl = `${getBaseUrl()}/review/approve?token=${rawToken}`;
      replyTo = getAdminRecipients()[0] || process.env.ADMIN_EMAIL || currentTicket.clientEmail;
    }

    const completedAt =
      input.status === "DONE"
        ? currentTicket.completedAt || timestamp
        : currentTicket.status === "DONE"
          ? null
          : currentTicket.completedAt;

    db.prepare(`
      UPDATE tickets
      SET
        status = ?,
        priority = ?,
        resolution_summary = ?,
        admin_notes = ?,
        client_review_requested_at = ?,
        client_review_email_sent_at = ?,
        completed_at = ?,
        updated_at = ?,
        last_status_changed_at = ?
      WHERE id = ?
    `).run(
      input.status,
      input.priority,
      resolutionSummary,
      adminNotes,
      input.status === "CLIENT_REVIEW"
        ? currentTicket.clientReviewRequestedAt || timestamp
        : currentTicket.clientReviewRequestedAt,
      needsReviewEmail ? timestamp : currentTicket.clientReviewEmailSentAt,
      completedAt,
      timestamp,
      currentTicket.status !== input.status ? timestamp : currentTicket.lastStatusChangedAt,
      input.ticketId
    );

    const changes: string[] = [];

    if (currentTicket.status !== input.status) {
      changes.push(`Status changed to ${input.status}.`);
    }

    if (currentTicket.priority !== input.priority) {
      changes.push(`Priority changed to ${input.priority}.`);
    }

    if ((currentTicket.resolutionSummary || "") !== (resolutionSummary || "")) {
      changes.push("Review summary updated.");
    }

    if ((currentTicket.adminNotes || "") !== (adminNotes || "")) {
      changes.push("Admin notes updated.");
    }

    writeAuditEntry(
      input.ticketId,
      input.actorName,
      currentTicket.status !== input.status ? "ticket_status_updated" : "ticket_updated",
      changes.join(" ") || "Ticket details updated."
    );

    return {
      title: currentTicket.title,
      projectName: currentTicket.projectName,
      clientName: currentTicket.clientName,
      clientEmail: currentTicket.clientEmail,
      resolutionSummary,
      approvalUrl,
      replyTo
    };
  });

  return updateTicketTransaction();
}

export type ReviewLookupResult =
  | { kind: "missing" | "invalid" | "expired" | "used" }
  | { kind: "valid"; context: ReviewRequestContext };

export function getReviewRequestContext(rawToken: string | null): ReviewLookupResult {
  if (!rawToken) {
    return {
      kind: "missing"
    };
  }

  const db = getDb();
  const tokenRow = db
    .prepare(`
      SELECT
        approval_tokens.expires_at AS expiresAt,
        approval_tokens.used_at AS usedAt,
        tickets.id AS ticketId,
        tickets.title AS ticketTitle,
        tickets.status AS status,
        tickets.resolution_summary AS resolutionSummary,
        projects.name AS projectName,
        users.name AS clientName
      FROM approval_tokens
      INNER JOIN tickets ON tickets.id = approval_tokens.ticket_id
      INNER JOIN projects ON projects.id = tickets.project_id
      INNER JOIN users ON users.id = tickets.client_id
      WHERE approval_tokens.token_hash = ?
      LIMIT 1
    `)
    .get(hashToken(rawToken)) as
    | {
        expiresAt: string;
        usedAt: string | null;
        ticketId: number;
        ticketTitle: string;
        status: TicketStatus;
        resolutionSummary: string | null;
        projectName: string;
        clientName: string;
      }
    | undefined;

  if (!tokenRow) {
    return {
      kind: "invalid"
    };
  }

  if (tokenRow.usedAt) {
    return {
      kind: "used"
    };
  }

  if (new Date(tokenRow.expiresAt).getTime() < Date.now()) {
    return {
      kind: "expired"
    };
  }

  return {
    kind: "valid",
    context: {
      ticketId: tokenRow.ticketId,
      ticketTitle: tokenRow.ticketTitle,
      projectName: tokenRow.projectName,
      clientName: tokenRow.clientName,
      resolutionSummary: tokenRow.resolutionSummary,
      expiresAt: tokenRow.expiresAt,
      status: tokenRow.status
    }
  };
}

export function approveTicketReview(rawToken: string) {
  const lookup = getReviewRequestContext(rawToken);

  if (lookup.kind !== "valid") {
    throw new Error("This approval link is no longer valid.");
  }

  const db = getDb();
  const tokenHash = hashToken(rawToken);

  const approveTransaction = db.transaction(() => {
    const timestamp = nowIso();
    db.prepare(`
      UPDATE approval_tokens
      SET used_at = ?
      WHERE token_hash = ?
        AND used_at IS NULL
    `).run(timestamp, tokenHash);

    db.prepare(`
      UPDATE tickets
      SET status = 'DONE',
          completed_at = ?,
          updated_at = ?,
          last_status_changed_at = ?
      WHERE id = ?
    `).run(timestamp, timestamp, timestamp, lookup.context.ticketId);

    writeAuditEntry(
      lookup.context.ticketId,
      lookup.context.clientName,
      "ticket_completed_by_client",
      "Client approved the completed work from the review email."
    );
  });

  approveTransaction();

  return lookup.context;
}
