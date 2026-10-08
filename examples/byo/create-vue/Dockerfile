# A real create-vue app: the scaffolder runs at build time, so this stays in step with it.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /work
RUN npm create vue@latest app -- --default
WORKDIR /work/app
RUN npm install
# Vite must listen beyond loopback (--host) and on the port TDK assigns.
CMD npx vite --host 0.0.0.0 --port ${PORT:-3000}
