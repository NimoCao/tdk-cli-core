# A real create-next-app project (App Router, TypeScript, no Tailwind): the scaffolder runs at build time.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /work
RUN npx --yes create-next-app@latest app --ts --app --no-tailwind --eslint --no-src-dir --import-alias "@/*" \
    --use-npm --yes --disable-git </dev/null
WORKDIR /work/app
# next dev must listen beyond loopback (-H) and on the port TDK assigns.
CMD ["sh", "-c", "npx next dev -H 0.0.0.0 -p ${PORT:-3000}"]
