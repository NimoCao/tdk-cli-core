# A real Angular CLI app (`ng new`, CSS, routing, no SSR): the scaffolder runs at build time.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
# Never ask about analytics during the build.
ENV NG_CLI_ANALYTICS=false CI=true
WORKDIR /work
RUN npx --yes @angular/cli@latest new app --defaults --skip-git --skip-install --routing --style=css \
    --ssr=false --ai-config=none --package-manager=npm </dev/null
WORKDIR /work/app
RUN npm install
# ng serve must listen beyond loopback (--host) and on the port TDK assigns.
CMD ["sh", "-c", "npx ng serve --host 0.0.0.0 --port ${PORT:-4200}"]
