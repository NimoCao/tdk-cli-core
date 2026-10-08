# A minimal Sinatra 4 app (Sinatra has no project generator, so the app is the files next to this Dockerfile).
FROM ruby:3.4-slim@sha256:976f45719573889b0ef02fcff5fd7a486cb09a56ad11c472d51d49604c31d6ab
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends build-essential >/dev/null && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY Gemfile ./
RUN bundle install --quiet
COPY app.rb ./
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --no-create-home app
USER app
# Classic-style apps start their own server when run directly (Puma here); app.rb binds 0.0.0.0 and reads PORT.
CMD ["ruby", "app.rb"]
