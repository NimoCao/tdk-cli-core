# A minimal Actix Web 4 app (Actix has no project generator, so the app is the files next to this Dockerfile).
FROM rust:1-slim@sha256:24e632c09342c20abf8312cf4f61430a911c01ed3a5e4c02b87292b1c39c5273 AS build
WORKDIR /app
COPY Cargo.toml ./
# Build the dependencies first so source edits do not recompile them.
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY src ./src
RUN touch src/main.rs && cargo build --release

FROM debian:stable-slim@sha256:eb593cf2c358cacef45ca0a424bbc7d30cfa3466265fc2662b9466a0ca6ba1c5
COPY --from=build /app/target/release/actix-app /usr/local/bin/actix-app
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --no-create-home app
USER app
CMD ["actix-app"]
