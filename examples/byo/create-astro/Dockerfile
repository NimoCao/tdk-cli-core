# A real create-astro project (minimal template): the scaffolder runs at build time.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /work
RUN npm create astro@latest app -- --template minimal --no-install --no-git --yes
WORKDIR /work/app
RUN npm install
# astro dev must listen beyond loopback (--host) and on the port TDK assigns.
CMD ["sh", "-c", "npx astro dev --host 0.0.0.0 --port ${PORT:-4321}"]
