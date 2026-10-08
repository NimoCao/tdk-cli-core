# A real Docusaurus site (classic template, TypeScript): the scaffolder runs at build time.
# glibc base image, not Alpine: the template enables Docusaurus' Rspack bundler, whose musl native binding was not installed.
FROM node:22-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends git >/dev/null && rm -rf /var/lib/apt/lists/*
ENV DO_NOT_TRACK=1 CI=true
WORKDIR /work
RUN npx --yes create-docusaurus@latest app classic --typescript --skip-install </dev/null
WORKDIR /work/app
RUN npm install --no-audit --no-fund
RUN chown -R node:node .
USER node
# The dev server must listen beyond loopback (--host) and on the port TDK assigns.
CMD ["sh", "-c", "npx docusaurus start --host 0.0.0.0 --port ${PORT:-3000} --no-open"]
