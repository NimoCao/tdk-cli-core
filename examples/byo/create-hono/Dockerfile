# A real Hono app from `create-hono` (Bun template): the scaffolder runs at build time.
FROM oven/bun:1@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895
WORKDIR /work
RUN bun create hono@latest app --template bun --install --pm bun
WORKDIR /work/app
# The template exports the app (`export default app`) and Bun serves it, reading PORT itself, so nothing needs patching.
# `bun run dev` is `bun run --hot src/index.ts`.
CMD ["bun", "run", "dev"]
