# One-shot migration job: `mikro-orm migration:up` applies migrations/ to TDK's Postgres and exits 0.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /job
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY mikro-orm.config.js ./
COPY migrations ./migrations
ENV MIKRO_ORM_CLI_CONFIG=./mikro-orm.config.js
RUN chown -R node:node .
USER node
CMD ["npx", "mikro-orm", "migration:up"]
