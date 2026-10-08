# A real Elysia app from `bun create elysia`: the scaffolder runs at build time.
FROM oven/bun:1@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895
WORKDIR /work
RUN bun create elysia app
WORKDIR /work/app
# The generated app hard-codes `.listen(3000)`; TDK assigns the port through PORT. Patch it, and fail the build if the line is not there.
RUN sed -i 's/\.listen(3000)/.listen(Number(process.env.PORT ?? 3000))/' src/index.ts \
 && grep -q 'process.env.PORT' src/index.ts
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --no-create-home app
RUN chown -R app:app /work/app
USER app
# `bun run dev` is `bun run --watch src/index.ts`.
CMD ["bun", "run", "dev"]
