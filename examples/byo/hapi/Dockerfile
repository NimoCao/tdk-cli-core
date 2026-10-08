# A minimal Hapi app (Hapi has no project generator, so the app is the two files next to this Dockerfile).
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./
# server.js binds 0.0.0.0 and reads PORT, which TDK sets.
CMD ["node", "server.js"]
