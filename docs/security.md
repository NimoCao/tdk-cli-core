# Security: network calls, secrets and supply chain

Answers for a security reviewer. Each line says what was checked in the source at the time of writing; anything not checked is marked **Not audited**. Report a vulnerability through [SECURITY.md](../SECURITY.md).

## What TDK sends over the network

TDK has no telemetry or analytics ([project overview](project-overview.md#telemetry)). Searching `cli/src` for HTTP clients finds these outbound calls, and no others:

| Call | When | Goes to | Sends |
| --- | --- | --- | --- |
| `tdk upgrade` version check and download | Only when you run `tdk upgrade` | `api.github.com` releases, GitHub release assets, and on Windows `registry.npmjs.org` | An ordinary unauthenticated request. The binary and the bundled engine are checked against the release `checksums.txt` before the installed copy is replaced (`checksum mismatch` error path read in `upgrade.ts`). |
| Premium extension fetch | Only when `TDK_LICENSE_KEY` is set and a premium feature is used | `TDK_PREMIUM_ENDPOINT`, default a Cloudflare Worker (`tdk-extension-dist.oranguman.workers.dev`) | The licence key as a bearer token, the resource name and a random per-project id stored in `.tdk/`. A bundle is cached under `~/.tdk/cache/`. |
| `tdk doctor` service ping, and the `smoke` checks that `tdk up` runs for services that declare them | When services are running; `tdk doctor --no-ping` skips the ping | `<project>.localhost` (or `TDK_SERVICE_BASE_URL`) | A GET to each service's health endpoint. |

Without a licence key, and without running `tdk upgrade`, the CLI makes no outbound request of its own. There is no update check on startup.

`tdk up` itself pulls container images and, inside image builds, package-manager dependencies (for example `bun install`). Those requests come from Docker and from your own `package.json`, not from the CLI. See [corporate proxy and private registry](faq-teams.md#corporate-proxy-vpn-private-registry-custom-ca) for what is not tested yet.

## Secrets

- Secret values live in the gitignored project `.env`; `service.json` holds only their names. See [Environment, params and secrets](environment.md).
- Generated files contain no secret values, and `DB_PASSWORD` and `JWT_SECRET` are generated per project, never shared between projects.
- `TDK_SECRET_PROVIDER=infisical` leaves secrets to Infisical and injects nothing from `.env`.
- **Not audited:** whether a secret can appear in Tilt UI output or container logs when an application prints its own environment.

## Images

Images defined by the engine, with the tag in the source:

| Image | Tag | Used for |
| --- | --- | --- |
| `traefik` | `v3.6.8` | Ingress |
| `postgres` | `16-alpine` | Database |
| `oven/bun` | `1.3.11-alpine` | Bun runtime layers |
| `node` | `22-alpine` | Node backend runtime |
| `nginx` | `1.27-alpine` | Static frontend runtime |
| `sablierapp/sablier` | `1.18.0` | Idle stop (premium) |

Tags are version tags, not digests, so a registry could still move them. The golden layer images (`...-l1:latest` and similar) are built locally from these bases and are not pulled. Images for the optional features (monitoring, ELK, Debezium and others) and the generated `FROM` lines for Go, Rust, Python and Java were **not audited** here. Also not in the table: the scaffolded `Dockerfile` that `tdk up` does not build uses `oven/bun:1.2`, the bring-your-own placeholder `Dockerfile` uses `nginx:1.27-alpine`, and `engine/topologies/tilt/manifest/constants.star` names `node:20-alpine`; where that last one is used was not checked.

## Releases

- The npm package is published from GitHub Actions with `npm publish --provenance` ([release workflow](../.github/workflows/release-binaries.yml)).
- Release binaries and the engine archive have SHA-256 entries in `checksums.txt`, verified by `tdk upgrade` (read in the source). The `install.sh` in this repository only hands off to the official installer at `tdk-landscape.github.io/install.sh`, which is not in this repository; its header comment says it verifies the release checksums, and that script was **not audited** here. The checksums come from the same release as the binaries, so they detect a bad download but not a compromised release.
- After each release, the workflow signs `checksums.txt` (keyless, with [cosign](https://docs.sigstore.dev/) and the workflow's GitHub identity) and attaches `checksums.txt.sigstore.json` next to the binaries in the [tdk-cli-releases](https://github.com/tdk-landscape/tdk-cli-releases/releases) release, and both files to a release with the same tag in this repository (where OpenSSF Scorecard looks). This step runs last and is best effort: it can fail without affecting the npm package or the binaries, so a release may exist without it. Check a download with cosign **3.0 or newer** (the signature is a Sigstore bundle in format v0.3, which cosign 2.x cannot read and reports as "bundle does not contain cert for verification"). This was checked on v1.3.130 with cosign 3.0.6, and a changed `checksums.txt` or a different workflow identity both fail:

  ```bash
  cosign verify-blob --bundle checksums.txt.sigstore.json \
    --certificate-identity-regexp 'https://github.com/tdk-landscape/tdk-cli-core/.github/workflows/release-binaries.yml@.*' \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com checksums.txt
  shasum -a 256 -c checksums.txt   # then check the file you downloaded against the verified list
  ```

- The binaries themselves are not individually signed, and there is no SBOM.
- Core is MIT, so you can build from source.
