import type { BlobUploadParams } from "../interface.js";

/**
 * Builds a BlobUploadParams with the given data bytes.
 * Generates a fake-but-valid-looking checksum (64 hex chars) for test use.
 */
export function makeBlobData(
  bytes: Uint8Array,
  overrides: Partial<BlobUploadParams> & { storageKey?: string } = {},
): BlobUploadParams {
  return {
    storageKey: overrides.storageKey ?? `sys_test/blob_${crypto.randomUUID()}`,
    data: bytes,
    mimeType: overrides.mimeType ?? "application/octet-stream",
    checksum: overrides.checksum ?? fakeChecksum(),
  };
}

/**
 * Generates a deterministic fake checksum for a given seed value.
 * Not a real SHA-256 — only for use in tests.
 */
export function fakeChecksum(seed = 0): string {
  return String(seed).padStart(64, "0");
}

/** Creates a small Uint8Array filled with the given byte value. */
export function makeBytes(value: number, length = 16): Uint8Array {
  return new Uint8Array(length).fill(value);
}
