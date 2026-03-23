/**
 * Shared setup helpers for API service integration tests (PGlite).
 */
import { AEAD_NONCE_BYTES, serializeEncryptedBlob } from "@pluralscape/crypto";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, EncryptedBlob, SessionId, SystemId } from "@pluralscape/types";

/** Build a minimal T1 EncryptedBlob (no bucketId) for DB insertion. */
export function testBlob(ciphertext: Uint8Array = new Uint8Array([1, 2, 3])): EncryptedBlob {
  const nonce = new Uint8Array(AEAD_NONCE_BYTES);
  nonce.fill(0xaa);
  return {
    ciphertext,
    nonce,
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
  };
}

/**
 * Create a base64-encoded serialized EncryptedBlob suitable for service params.
 * This round-trips through the real blob codec so parseAndValidateBlob succeeds.
 */
export function testEncryptedDataBase64(): string {
  const blob = testBlob();
  const serialized = serializeEncryptedBlob(blob);
  return Buffer.from(serialized).toString("base64");
}

/** Build a minimal AuthContext for integration tests. */
export function makeAuth(accountId: string, systemId: string): AuthContext {
  return {
    accountId: accountId as AccountId,
    systemId: systemId as SystemId,
    sessionId: `sess_${crypto.randomUUID()}` as SessionId,
    accountType: "system",
    ownedSystemIds: new Set([systemId as SystemId]),
  };
}

/** No-op audit writer for tests that don't need to verify audit entries. */
export const noopAudit: AuditWriter = async () => {};

/** Generate a properly-prefixed member ID. */
export function genMemberId(): string {
  return `mem_${crypto.randomUUID()}`;
}

/** Generate a properly-prefixed custom front ID. */
export function genCustomFrontId(): string {
  return `cf_${crypto.randomUUID()}`;
}

/** Generate a properly-prefixed fronting session ID. */
export function genFrontingSessionId(): string {
  return `fs_${crypto.randomUUID()}`;
}

/** Generate a properly-prefixed timer config ID. */
export function genTimerId(): string {
  return `tmr_${crypto.randomUUID()}`;
}

/** Generate a properly-prefixed webhook config ID. */
export function genWebhookId(): string {
  return `wh_${crypto.randomUUID()}`;
}

/** Generate a properly-prefixed webhook delivery ID. */
export function genWebhookDeliveryId(): string {
  return `wd_${crypto.randomUUID()}`;
}

/** Generate a properly-prefixed check-in record ID. */
export function genCheckInRecordId(): string {
  return `cir_${crypto.randomUUID()}`;
}

/** Generate a properly-prefixed structure entity ID. */
export function genStructureEntityId(): string {
  return `ste_${crypto.randomUUID()}`;
}
