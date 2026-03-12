FROM alpine:3.21

RUN apk add --no-cache bash sqlite tzdata

COPY backup/run-backup.sh /usr/local/bin/run-backup.sh
COPY backup/start-cron.sh /usr/local/bin/start-cron.sh

RUN chmod +x /usr/local/bin/run-backup.sh /usr/local/bin/start-cron.sh

CMD ["/usr/local/bin/start-cron.sh"]
