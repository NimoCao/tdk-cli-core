# A real create-adonisjs app (slim starter kit, no database): the scaffolder runs at build time.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
RUN apk add --no-cache git
WORKDIR /work
RUN npm create adonisjs@latest app -- --kit=github:adonisjs/slim-starter-kit --pkg=npm --skip-migrations </dev/null
WORKDIR /work/app
# The app reads PORT and HOST from the environment; HOST must be beyond loopback.
ENV HOST=0.0.0.0
RUN chown -R node:node .
USER node
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD nc -z 127.0.0.1 ${PORT:-3333} || exit 1
CMD ["npm", "run", "dev"]
