/**
 * Shared constants for test factories.
 *
 * Covers: NOW timestamp, re-exports of TEST_MASTER_KEY and TEST_SYSTEM_ID
 * Companion files: member.ts, fronting.ts, comms.ts, structure-innerworld.ts, misc.ts
 */
import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "../../hooks/__tests__/helpers/test-crypto.js";

import type { UnixMillis } from "@pluralscape/types";

export { TEST_MASTER_KEY, TEST_SYSTEM_ID };

export const NOW = 1_700_000_000_000 as UnixMillis;
