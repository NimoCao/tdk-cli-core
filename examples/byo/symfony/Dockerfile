# A real Symfony skeleton (`composer create-project symfony/skeleton`) plus one controller file.
FROM composer:2@sha256:af98f42dfff7c68ba8d53c2164fd9fde1087b7d449514baa38c418b1f6bc4bac AS build
WORKDIR /work
RUN composer create-project symfony/skeleton app --no-interaction --prefer-dist
COPY HealthController.php /work/app/src/Controller/HealthController.php

FROM php:8.4-cli@sha256:1d2cf2b7d715b5b3aa959f0150ccbcc7b71e0181b637e443abf40a7fb56bf79a
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends unzip git >/dev/null && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /work/app /app
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --no-create-home app
RUN chown -R app:app /app
USER app
# PHP's built-in server: listen beyond loopback and on the port TDK assigns. For local use only.
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-8000} -t public"]
