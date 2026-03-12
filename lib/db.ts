import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

import { hashPassword } from "@/lib/security";
import { nowIso } from "@/lib/utils";

declare global {
  var __ticketingDb: Database.Database | undefined;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveDatabasePath() {
  const configuredPath = process.env.DATABASE_PATH;

  if (!configuredPath) {
    return path.join(process.cwd(), "data", "ticketing.db");
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(process.cwd(), configuredPath);
}

function ensureDatabaseDirectory(databasePath: string) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

function initializeSchema(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CLIENT')),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      company_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(client_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
      status TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'CLIENT_REVIEW', 'DONE')),
      resolution_summary TEXT,
      admin_notes TEXT,
      client_review_requested_at TEXT,
      client_review_email_sent_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_status_changed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON tickets(client_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_project_id ON tickets(project_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

    CREATE TABLE IF NOT EXISTS ticket_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL CHECK (author_role IN ('ADMIN', 'CLIENT')),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);

    CREATE TABLE IF NOT EXISTS ticket_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      actor_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket_id ON ticket_activity(ticket_id);

    CREATE TABLE IF NOT EXISTS approval_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_approval_tokens_ticket_id ON approval_tokens(ticket_id);

    CREATE TABLE IF NOT EXISTS login_rate_limits (
      bucket TEXT PRIMARY KEY,
      failure_count INTEGER NOT NULL,
      first_failure_at TEXT NOT NULL,
      last_failure_at TEXT NOT NULL,
      locked_until TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_login_rate_limits_locked_until ON login_rate_limits(locked_until);
  `);
}

function getBootstrapAdminConfig() {
  const adminName = process.env.ADMIN_NAME?.trim() || "BomerTech Admin";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "No admin user exists yet. Set ADMIN_EMAIL and ADMIN_PASSWORD before starting the app to bootstrap the first admin account."
    );
  }

  if (!EMAIL_PATTERN.test(adminEmail)) {
    throw new Error("ADMIN_EMAIL must be a valid email address before bootstrapping the first admin account.");
  }

  if (adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters before bootstrapping the first admin account.");
  }

  if (adminEmail === "owner@example.com" || adminPassword === "ChangeMeNow!2026") {
    throw new Error("Replace the example admin credentials before bootstrapping the first admin account.");
  }

  return {
    adminName,
    adminEmail,
    adminPassword
  };
}

function bootstrapAdmin(db: Database.Database) {
  const adminCount = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN'")
    .get() as { count: number };

  if (adminCount.count > 0) {
    return;
  }

  const { adminName, adminEmail, adminPassword } = getBootstrapAdminConfig();
  const timestamp = nowIso();

  db.prepare(`
    INSERT INTO users (role, name, email, password_hash, company_name, is_active, created_at, updated_at)
    VALUES (@role, @name, @email, @passwordHash, @companyName, 1, @createdAt, @updatedAt)
  `).run({
    role: "ADMIN",
    name: adminName,
    email: adminEmail.toLowerCase(),
    passwordHash: hashPassword(adminPassword),
    companyName: "BomerTech",
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

export function getDb() {
  if (!global.__ticketingDb) {
    const databasePath = resolveDatabasePath();
    ensureDatabaseDirectory(databasePath);

    global.__ticketingDb = new Database(databasePath);
    initializeSchema(global.__ticketingDb);
    bootstrapAdmin(global.__ticketingDb);
  }

  return global.__ticketingDb;
}

export function writeAuditEntry(ticketId: number, actorName: string, actionType: string, details: string) {
  const db = getDb();

  db.prepare(`
    INSERT INTO ticket_activity (ticket_id, actor_name, action_type, details, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(ticketId, actorName, actionType, details, nowIso());
}
