#!/usr/bin/env bash
# Copyright (c) 2026 TDK Landscape contributors
# SPDX-License-Identifier: MIT
# Legacy installer URL for the TDK CLI.
#
# The official installer is https://tdk-landscape.github.io/install.sh. It
# installs the prebuilt `tdk` binary plus its bundled engine, verified
# against the release checksums, with no Node or Bun required. This script
# used to clone this repo and `bun link` it instead; it now hands off to the
# official installer so old
#   curl -fsSL https://raw.githubusercontent.com/tdk-landscape/tdk-cli-core/main/install.sh | bash
# commands keep working and every install method gets the same result.
#
# To work on TDK itself, clone the repo instead (see CONTRIBUTING.md).

set -euo pipefail

readonly OFFICIAL_INSTALLER="https://tdk-landscape.github.io/install.sh"

echo "Using the official TDK installer: ${OFFICIAL_INSTALLER}" >&2
curl -fsSL "${OFFICIAL_INSTALLER}" | sh
