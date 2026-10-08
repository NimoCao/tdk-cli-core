# A small Node service that talks to Turso's server (examples/byo/turso) with @libsql/client over HTTP.
FROM node:22-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./
# Override at run time if the Turso resource has another name or port.
ENV LIBSQL_URL=http://turso:4500
RUN chown -R node:node .
USER node
CMD ["node", "server.mjs"]
