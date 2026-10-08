# A real `rails new` app (minimal, SQLite file, no external database): the generator runs at build time.
FROM ruby:3.4-slim@sha256:976f45719573889b0ef02fcff5fd7a486cb09a56ad11c472d51d49604c31d6ab
ENV RAILS_ENV=development BUNDLE_PATH=/usr/local/bundle
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends build-essential git libyaml-dev libsqlite3-dev pkg-config curl >/dev/null \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /work
RUN gem install rails --no-document >/dev/null \
 && rails new app --minimal --skip-git --skip-docker --skip-kamal --skip-test -d sqlite3 --skip-bundle \
 && cd app && bundle install --quiet
WORKDIR /work/app
RUN bin/rails db:prepare
# Rails blocks unknown Host headers in development. Through Traefik the host is api.<project>.localhost, which the default
# allow-list rejects ("Blocked hosts: ..."), so allow any host for local use.
RUN echo 'Rails.application.config.hosts.clear' > config/initializers/tdk_hosts.rb
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --no-create-home app
RUN chown -R app:app /work/app
USER app
# Rails 7.1+ ships the /up health route. The server must listen beyond loopback (-b) and on TDK's port (-p).
# TDK gives every bring-your-own container a Postgres DATABASE_URL, which Rails prefers over config/database.yml; this app only
# has the SQLite adapter, so without `env -u DATABASE_URL` every request fails with "pg is not part of the bundle".
CMD ["sh", "-c", "rm -f tmp/pids/server.pid && exec env -u DATABASE_URL bin/rails server -b 0.0.0.0 -p ${PORT:-3000}"]
