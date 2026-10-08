# A real express-generator app (no view engine): the scaffolder runs at build time.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /work
RUN npx --yes express-generator@4 app --no-view
WORKDIR /work/app
RUN npm install
# The generated bin/www reads PORT and listens on all interfaces.
CMD ["node", "./bin/www"]
