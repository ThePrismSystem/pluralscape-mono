import type { KdfMasterKey } from "@pluralscape/crypto";
import type { SystemId } from "@pluralscape/types";

/**
 * Create a deterministic test master key for hook tests.
 * Uses a fixed fill byte so encrypted fixtures are reproducible.
 */
export function makeTestMasterKey(): KdfMasterKey {
  const raw = new Uint8Array(32).fill(0xab);
  function assertKdfMasterKey(key: Uint8Array): asserts key is KdfMasterKey {
    if (key.length !== 32) throw new Error("key must be 32 bytes");
  }
  assertKdfMasterKey(raw);
  return raw;
}

export const TEST_MASTER_KEY = makeTestMasterKey();
export const TEST_SYSTEM_ID = "test-system-00000000" as SystemId;
