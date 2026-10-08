# One-shot migration job: Atlas applies schema.hcl to TDK's Postgres and exits 0.
FROM alpine:3.20@sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc
RUN apk add --no-cache postgresql-client
COPY --from=arigaio/atlas:latest /atlas /usr/local/bin/atlas
COPY schema.hcl migrate.sh /
CMD ["sh", "/migrate.sh"]
