# One-shot migration job: dbmate applies db/migrations to TDK's Postgres and exits 0.
FROM ghcr.io/amacneil/dbmate:2@sha256:520c740c6e0ad73fde2cd1ea7e2b779aaf789d22aca8858f87a478e7094535fb
COPY db /db
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --no-create-home app
USER app
# TDK's DATABASE_URL carries a Prisma-style ?schema=public that non-Prisma drivers reject, so strip it.
# TDK's Postgres has SSL off, so ask the driver not to try it.
# --wait retries until Postgres accepts connections; --no-dump-schema keeps the job read-only on disk.
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["dbmate --url \"${DATABASE_URL%%\\?*}?sslmode=disable\" --migrations-dir /db/migrations --no-dump-schema --wait up"]
