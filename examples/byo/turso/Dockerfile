# Turso's open-source server (libSQL "sqld") as a TDK resource.
# The upstream image listens on 8080 and ignores PORT; TDK assigns the port, so bind sqld to $PORT instead.
# The image's own entrypoint (it creates the data directory and drops to the sqld user) is kept; only the command changes.
FROM ghcr.io/tursodatabase/libsql-server:latest@sha256:6dd3eb276d9d3604e4a48ac4a999a2e267814732d57d7e94c04ba71482333a67
CMD ["sh", "-c", "SQLD_HTTP_LISTEN_ADDR=0.0.0.0:${PORT:-8080} exec sqld"]
