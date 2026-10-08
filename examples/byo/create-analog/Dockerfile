# A real create-analog app: the scaffolder runs at build time.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /work
RUN npm create analog@latest app -- --template latest --skipTailwind --analogSFC=false --skipGit </dev/null
WORKDIR /work/app
# The template pins vite/vitest with "$ref" overrides that npm 10 cannot resolve.
RUN npm install -g npm@11 && npm install
# Vite must listen beyond loopback (--host) and on the port TDK assigns.
CMD npx vite --host 0.0.0.0 --port ${PORT:-3000}
