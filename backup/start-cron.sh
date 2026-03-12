#!/usr/bin/env bash
set -euo pipefail

CRON_SCHEDULE="${BACKUP_CRON:-0 2 * * *}"
export TZ="${TZ:-America/Los_Angeles}"

mkdir -p /var/spool/cron/crontabs
touch /var/log/cron.log

echo "${CRON_SCHEDULE} /usr/local/bin/run-backup.sh >> /var/log/cron.log 2>&1" > /etc/crontabs/root

echo "Starting backup cron with schedule: ${CRON_SCHEDULE} (${TZ})"

crond -f -l 2
