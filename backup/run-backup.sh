#!/usr/bin/env bash
set -euo pipefail

SOURCE_PATH="${BACKUP_SOURCE:-/app/data/ticketing.db}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"

if [[ ! -f "${SOURCE_PATH}" ]]; then
  echo "Skipping backup because database does not exist yet: ${SOURCE_PATH}"
  exit 0
fi

timestamp="$(date +%Y-%m-%d_%H-%M-%S)"
raw_backup="${BACKUP_DIR}/ticketing-${timestamp}.db"

sqlite3 "${SOURCE_PATH}" ".backup '${raw_backup}'"
gzip -f "${raw_backup}"

find "${BACKUP_DIR}" -type f -name "ticketing-*.db.gz" -mtime +"${KEEP_DAYS}" -delete

echo "Backup completed: ${raw_backup}.gz"
