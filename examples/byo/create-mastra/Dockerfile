# A real create-mastra project (empty template): the scaffolder runs at build time.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
RUN apk add --no-cache git
WORKDIR /work
RUN npm create mastra@latest app -- --empty --no-git --no-skills --no-install
WORKDIR /work/app
RUN npm install && grep -A8 '"scripts"' package.json
CMD ["npm", "run", "dev"]
