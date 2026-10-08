# A real loco app (no database, async background workers, no assets): the scaffolder runs at build time.
FROM rust:1-slim-bookworm@sha256:2c3a22f0a5533ea2dd5a16627bc841228151faa2d4de2644ac9987e4a2f1f2fa AS build
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends pkg-config libssl-dev git && rm -rf /var/lib/apt/lists/*
RUN cargo install loco
WORKDIR /work
RUN loco new --name app --path /work --db none --bg async --assets none --allow-in-git-repo
WORKDIR /work/app
RUN cargo build --release

FROM debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /work/app/target/release/app-cli /app/app-cli
COPY --from=build /work/app/config /app/config
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --no-create-home app
RUN chown -R app:app /app
USER app
# loco reads PORT and BINDING from the environment (see config/development.yaml); bind beyond loopback.
ENV BINDING=0.0.0.0
CMD ["./app-cli", "start"]
