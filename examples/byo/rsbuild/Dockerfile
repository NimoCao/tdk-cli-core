# A real create-rsbuild app: the scaffolder runs at build time.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /work
RUN npm create rsbuild@latest -- --dir app --template react-ts --tools none
WORKDIR /work/app
RUN npm install
CMD npx rsbuild dev --host 0.0.0.0 --port ${PORT:-3000}
