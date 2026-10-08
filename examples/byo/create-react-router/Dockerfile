# A real create-react-router project (default template, framework mode): the scaffolder runs at build time.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /work
RUN npx --yes create-react-router@latest app --yes --no-install --no-git-init --no-agent-skills </dev/null
WORKDIR /work/app
RUN npm install
# The dev server is Vite: listen beyond loopback (--host) and on the port TDK assigns.
CMD ["sh", "-c", "npx react-router dev --host 0.0.0.0 --port ${PORT:-5173}"]
