import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { createToken, hashToken, verifyPassword } from "@/lib/security";
import type { SessionUser, UserRole } from "@/lib/types";
import { addDays, nowIso } from "@/lib/utils";

const SESSION_COOKIE_NAME = "ticketing_session";
const LOGIN_WINDOW_MINUTES = getPositiveInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES, 15);
const LOGIN_MAX_ATTEMPTS_PER_EMAIL = getPositiveInteger(process.env.LOGIN_MAX_ATTEMPTS_PER_EMAIL, 8);
const LOGIN_MAX_ATTEMPTS_PER_IP = getPositiveInteger(process.env.LOGIN_MAX_ATTEMPTS_PER_IP, 20);
const LOGIN_LOCKOUT_MINUTES = getPositiveInteger(process.env.LOGIN_LOCKOUT_MINUTES, 15);

interface LoginRateLimitBucket {
  bucket: string;
  limit: number;
}

interface LoginRateLimitRow {
  failureCount: number;
  firstFailureAt: string;
  lockedUntil: string | null;
}

function getPositiveInteger(rawValue: string | undefined, fallback: number) {
  const parsed = Number.parseInt(rawValue || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSessionExpiry() {
  const ttlDays = Number(process.env.SESSION_TTL_DAYS || 14);
  return addDays(new Date(), ttlDays);
}

function addMinutes(date: Date, minutes: number) {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result.toISOString();
}

export function normalizeLoginEmail(email: string) {
  return email.trim().toLowerCase();
}

function getLoginRateLimitBuckets(email: string, clientIp: string | null): LoginRateLimitBucket[] {
  const buckets: LoginRateLimitBucket[] = [
    {
      bucket: `email:${email}`,
      limit: LOGIN_MAX_ATTEMPTS_PER_EMAIL
    }
  ];

  if (clientIp) {
    buckets.push({
      bucket: `ip:${clientIp}`,
      limit: LOGIN_MAX_ATTEMPTS_PER_IP
    });
  }

  return buckets;
}

function getLatestLockoutDate(rows: Array<{ lockedUntil: string | null }>) {
  let latestLockoutMs = 0;

  for (const row of rows) {
    if (!row.lockedUntil) {
      continue;
    }

    const lockoutMs = new Date(row.lockedUntil).getTime();

    if (lockoutMs > Date.now() && lockoutMs > latestLockoutMs) {
      latestLockoutMs = lockoutMs;
    }
  }

  return latestLockoutMs > 0 ? new Date(latestLockoutMs) : null;
}

export function getLoginLockout(email: string, clientIp: string | null) {
  const buckets = getLoginRateLimitBuckets(email, clientIp);

  if (buckets.length === 0) {
    return null;
  }

  const db = getDb();
  const placeholders = buckets.map(() => "?").join(", ");
  const rows = db
    .prepare(`
      SELECT locked_until AS lockedUntil
      FROM login_rate_limits
      WHERE bucket IN (${placeholders})
    `)
    .all(...buckets.map(({ bucket }) => bucket)) as Array<{ lockedUntil: string | null }>;

  return getLatestLockoutDate(rows);
}

export function clearFailedLoginAttempts(email: string, clientIp: string | null) {
  const buckets = getLoginRateLimitBuckets(email, clientIp);

  if (buckets.length === 0) {
    return;
  }

  const db = getDb();
  const deleteAttempt = db.prepare("DELETE FROM login_rate_limits WHERE bucket = ?");
  const clearTransaction = db.transaction(() => {
    for (const { bucket } of buckets) {
      deleteAttempt.run(bucket);
    }
  });

  clearTransaction();
}

export function recordFailedLoginAttempt(email: string, clientIp: string | null) {
  const buckets = getLoginRateLimitBuckets(email, clientIp);
  const now = new Date();
  const nowTimestamp = nowIso();
  const windowStart = addMinutes(now, -LOGIN_WINDOW_MINUTES);
  const lockoutUntil = addMinutes(now, LOGIN_LOCKOUT_MINUTES);
  const db = getDb();
  const selectAttempt = db.prepare(`
    SELECT
      failure_count AS failureCount,
      first_failure_at AS firstFailureAt,
      locked_until AS lockedUntil
    FROM login_rate_limits
    WHERE bucket = ?
    LIMIT 1
  `);
  const insertAttempt = db.prepare(`
    INSERT INTO login_rate_limits (bucket, failure_count, first_failure_at, last_failure_at, locked_until)
    VALUES (?, ?, ?, ?, ?)
  `);
  const updateAttempt = db.prepare(`
    UPDATE login_rate_limits
    SET failure_count = ?,
        first_failure_at = ?,
        last_failure_at = ?,
        locked_until = ?
    WHERE bucket = ?
  `);

  const updatedRows = db.transaction(() => {
    const rows: Array<{ lockedUntil: string | null }> = [];

    for (const { bucket, limit } of buckets) {
      const existing = selectAttempt.get(bucket) as LoginRateLimitRow | undefined;
      const shouldReset =
        !existing ||
        existing.firstFailureAt < windowStart ||
        Boolean(existing.lockedUntil && existing.lockedUntil <= nowTimestamp);
      const failureCount = shouldReset ? 1 : existing.failureCount + 1;
      const firstFailureAt = shouldReset ? nowTimestamp : existing.firstFailureAt;
      const lockedUntil = failureCount >= limit ? lockoutUntil : null;

      if (existing) {
        updateAttempt.run(failureCount, firstFailureAt, nowTimestamp, lockedUntil, bucket);
      } else {
        insertAttempt.run(bucket, failureCount, firstFailureAt, nowTimestamp, lockedUntil);
      }

      rows.push({
        lockedUntil
      });
    }

    return rows;
  })();

  return getLatestLockoutDate(updatedRows);
}

export async function getRequestClientIp() {
  const headerStore = await headers();

  for (const headerName of ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"]) {
    const value = headerStore.get(headerName);

    if (!value) {
      continue;
    }

    const ip = value.split(",")[0]?.trim();

    if (ip) {
      return ip;
    }
  }

  return null;
}

export async function createSession(userId: number) {
  const token = createToken();
  const tokenHash = hashToken(token);
  const db = getDb();
  const expiresAt = getSessionExpiry();

  db.prepare(`
    INSERT INTO sessions (user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, tokenHash, expiresAt, nowIso());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (currentToken) {
    getDb()
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .run(hashToken(currentToken));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const db = getDb();
  const session = db
    .prepare(`
      SELECT
        users.id,
        users.name,
        users.email,
        users.company_name AS companyName,
        users.role,
        sessions.expires_at AS expiresAt
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
        AND users.is_active = 1
      LIMIT 1
    `)
    .get(hashToken(token)) as
    | (SessionUser & {
        expiresAt: string;
      })
    | undefined;

  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    return null;
  }

  return {
    id: session.id,
    name: session.name,
    email: session.email,
    companyName: session.companyName,
    role: session.role
  };
}

export async function requireUser(role?: UserRole) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (role && user.role !== role) {
    redirect("/dashboard");
  }

  return user;
}

export async function loginWithPassword(email: string, password: string) {
  const db = getDb();
  const normalizedEmail = normalizeLoginEmail(email);
  const user = db
    .prepare(`
      SELECT id, name, email, company_name AS companyName, role, password_hash AS passwordHash
      FROM users
      WHERE email = ?
        AND is_active = 1
      LIMIT 1
    `)
    .get(normalizedEmail) as
    | (SessionUser & {
        passwordHash: string;
      })
    | undefined;

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  await createSession(user.id);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    companyName: user.companyName,
    role: user.role
  } satisfies SessionUser;
}
