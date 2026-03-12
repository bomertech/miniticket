# BomerTech Ticketing

A Next.js + SQLite client ticketing system with:

- Client login and project-scoped dashboard
- Admin login with client, project, and ticket management
- Ticket states: `Not started`, `In progress`, `Client review`, `Done`
- Automatic admin email alerts for new tickets
- Client review emails with approval links
- Nightly SQLite backups through a Docker Compose sidecar

## Stack

- Next.js App Router
- SQLite via `better-sqlite3`
- Server-side sessions stored in SQLite
- SMTP email delivery via `nodemailer`
- Docker Compose for app + backup services

## Environment

The project includes `.env.example` and a local `.env` template. Set these before the first startup:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

The app refuses to bootstrap the first admin account until both values are explicitly set to non-example credentials. After the first admin exists in the database, those bootstrap values are no longer used.

Replace the remaining placeholder values in `.env` before deploying, especially:

- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `APP_URL`

Important settings:

- `DATABASE_PATH`: local SQLite file path
- `TICKET_REVIEW_TOKEN_TTL_HOURS`: approval link lifetime
- `LOGIN_RATE_LIMIT_WINDOW_MINUTES`: rolling login attempt window
- `LOGIN_MAX_ATTEMPTS_PER_EMAIL`: failed sign-ins allowed per email within the window
- `LOGIN_MAX_ATTEMPTS_PER_IP`: failed sign-ins allowed per IP within the window
- `LOGIN_LOCKOUT_MINUTES`: temporary lockout duration after hitting a login limit
- `BACKUP_CRON`: nightly backup schedule, default `0 2 * * *`
- `BACKUP_KEEP_DAYS`: compressed backup retention
- `BACKUP_TZ`: backup service timezone

## Local Development

```bash
npm install
npm run dev
```

The app will bootstrap the first admin user from the explicit `ADMIN_*` values in `.env`.

## Deployment

For a fresh deployment:

1. Copy `.env.example` to `.env`.
2. Set `APP_URL` to the public HTTPS origin for the app.
3. Set a real `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` for first boot.
4. Set the SMTP variables if you want ticket alerts and review emails.
5. Start the stack with Docker Compose.

The runtime SQLite database under `data/` and generated backups under `backups/` are intentionally ignored by git and excluded from the Docker build context. Keep them as runtime-only state, not source-controlled files.

After the first admin account is created, rotate or blank `ADMIN_PASSWORD` in `.env` if you do not want bootstrap credentials sitting in deployment config. The app only uses `ADMIN_*` values when no admin exists in the database.

## Docker Compose

```bash
docker compose up -d --build
```

Services:

- `app`: Next.js production server on port `3000`
- `backup`: cron-driven backup container writing `.gz` snapshots into [`backups`](/Users/danbomer/Documents/BomerTech/ticketing/backups)

SQLite data lives in the named Docker volume `ticketing_sqlite_data`.

## Workflow

1. Admin creates client accounts.
2. Admin creates projects for each client.
3. Client logs in, selects a project, and submits tickets.
4. Admin updates ticket state and fills the completion summary.
5. When the admin moves a ticket to `Client review`, the client receives an email.
6. The client can approve the work from the secure review link or reply to the email for follow-up.

## Validation

These checks were run successfully:

```bash
npm run typecheck
npm run build
docker compose config
```
