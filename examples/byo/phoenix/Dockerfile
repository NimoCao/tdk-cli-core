# A real `mix phx.new` project (no Ecto, no mailer, no dashboard, no assets pipeline): the generator runs at build time.
FROM elixir:1.18-slim@sha256:da93d9bdac88dc29765abc71485adf7d2afdbd1ff710e36094edf3b057979a67
ENV MIX_ENV=dev
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends git >/dev/null && rm -rf /var/lib/apt/lists/* \
 && mix local.hex --force >/dev/null && mix local.rebar --force >/dev/null \
 && mix archive.install hex phx_new --force >/dev/null
WORKDIR /work
RUN mix phx.new app --no-ecto --no-mailer --no-dashboard --no-gettext --no-assets --install
WORKDIR /work/app
RUN mix compile
# Inside `docker build` the generator writes `http: [ip: {127, 0, 0, 1}]` (loopback only, unreachable from Traefik), so bind
# all IPv4 interfaces. Fail the build if the line is not there. config/runtime.exs already reads PORT.
RUN sed -i 's/http: \[ip: {127, 0, 0, 1}\]/http: [ip: {0, 0, 0, 0}]/' config/dev.exs \
 && grep -q 'http: \[ip: {0, 0, 0, 0}\]' config/dev.exs
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --no-create-home app
RUN chown -R app:app /work
USER app
CMD ["mix", "phx.server"]
