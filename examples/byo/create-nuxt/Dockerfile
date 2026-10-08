# A real nuxi init project (minimal template): the scaffolder runs at build time.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
RUN apk add --no-cache git
WORKDIR /work
RUN npx --yes nuxi@latest init app --template minimal --no-install --packageManager npm --gitInit=false </dev/null
WORKDIR /work/app
RUN npm install
# nuxt dev must listen beyond loopback (--host) and on the port TDK assigns.
CMD ["sh", "-c", "npx nuxt dev --host 0.0.0.0 --port ${PORT:-3000}"]
