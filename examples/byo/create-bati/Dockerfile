# A real create-bati app (React + Hono, no database): the scaffolder runs at build time.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /work
RUN npm create bati@latest app -- --react --hono --skip-git
WORKDIR /work/app
RUN npm install && npm run build
# The generated production server reads PORT and binds all interfaces.
ENV NODE_ENV=production
RUN chown -R node:node .
USER node
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD nc -z 127.0.0.1 ${PORT:-3000} || exit 1
CMD ["npm", "run", "preview"]
