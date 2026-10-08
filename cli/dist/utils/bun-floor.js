// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { MIN_BUN_VERSION, versionMeetsMinimum } from "../commands/doctor.js";
/** The Bun floor `tdk doctor` enforces, so `tdk up` cannot drift from it. */
export function bunMeetsFloor(version) {
    return versionMeetsMinimum(version, MIN_BUN_VERSION);
}
/** "1.2+" for a floor of 1.2.0, the wording the preflight already printed. */
export const BUN_FLOOR_LABEL = `${MIN_BUN_VERSION[0]}.${MIN_BUN_VERSION[1]}+`;
//# sourceMappingURL=bun-floor.js.map