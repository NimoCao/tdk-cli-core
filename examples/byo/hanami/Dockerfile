# A real `hanami new` app (Ruby 3.4, no database): the generator runs at build time.
FROM ruby:3.4-slim@sha256:976f45719573889b0ef02fcff5fd7a486cb09a56ad11c472d51d49604c31d6ab
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends build-essential git libyaml-dev curl >/dev/null \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /work
RUN gem install hanami --no-document >/dev/null \
 && hanami new bookshelf --skip-db --skip-assets \
 && cd bookshelf && bundle install --quiet
WORKDIR /work/bookshelf
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --no-create-home app
RUN chown -R app:app /work
USER app
# The server must listen beyond loopback (--host) and on TDK's port.
CMD ["sh", "-c", "exec bundle exec hanami server --host 0.0.0.0 --port ${PORT:-2300}"]
