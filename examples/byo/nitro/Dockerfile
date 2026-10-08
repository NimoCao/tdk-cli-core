FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /app
COPY --from=build /app/.output ./.output
# Nitro's node server reads PORT and HOST from the environment.
ENV HOST=0.0.0.0
RUN chown -R node:node .
USER node
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD nc -z 127.0.0.1 ${PORT:-3000} || exit 1
CMD ["node", ".output/server/index.mjs"]
