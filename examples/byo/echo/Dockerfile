# A minimal Echo v4 app (Echo has no project generator, so the app is the two files next to this Dockerfile).
FROM golang:1.25-alpine@sha256:1ae0735f00daffa3aaf1363a5184c0d2dc55c78e3db4ec70241cdac97bf84b59 AS build
WORKDIR /src
COPY go.mod main.go ./
# `go mod tidy` resolves Echo and writes go.sum at build time, so no go.sum is committed.
RUN go mod tidy && CGO_ENABLED=0 go build -o /out/app .

FROM alpine:3.20@sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc
COPY --from=build /out/app /app
RUN addgroup -g 1000 app && adduser -u 1000 -G app -D -H app
USER app
CMD ["/app"]
