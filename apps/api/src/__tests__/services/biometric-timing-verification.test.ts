/**
 * Verification test for api-jx0c: confirm that biometric auth uses
 * hash-then-DB-lookup pattern, making constant-time comparison unnecessary.
 *
 * The biometric verification flow:
 * 1. Hash the client-supplied token with BLAKE2b (genericHash)
 * 2. Query DB with WHERE tokenHash = <hashed value>
 * 3. If no row found, reject
 *
 * Because the token is hashed before comparison, an attacker cannot use
 * timing side-channels to incrementally guess the raw token. The DB
 * performs an index lookup on the hash, not a byte-by-byte string compare.
 * This is the same pattern used by session token auth (hashSessionToken
 * then DB lookup by hash).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("biometric auth timing safety (structural verification)", () => {
  const servicePath = resolve(import.meta.dirname, "../../services/biometric.service.ts");
  const serviceSource = readFileSync(servicePath, "utf8");

  it("hashes the token before any DB comparison", () => {
    // The service must call hashToken() on the raw token before the DB query
    expect(serviceSource).toContain("hashToken(parsed.data.token)");
  });

  it("uses DB WHERE clause for lookup, not in-memory comparison", () => {
    // The DB query uses eq() with the hashed token — no === or timingSafeEqual needed
    expect(serviceSource).toContain("eq(biometricTokens.tokenHash, tokenHash)");
  });

  it("never compares raw tokens with === or ==", () => {
    // Ensure no direct string comparison of the raw token value
    // The only string comparisons should be for non-secret fields
    const lines = serviceSource.split("\n");
    for (const line of lines) {
      // Skip comments and imports
      if (line.trimStart().startsWith("//") || line.trimStart().startsWith("import")) continue;
      // No direct comparison of parsed.data.token or token variable with === or ==
      if (line.includes("parsed.data.token") && (line.includes("===") || line.includes("=="))) {
        throw new Error(`Raw token compared directly: ${line.trim()}`);
      }
    }
  });

  it("uses a cryptographic hash function (BLAKE2b genericHash)", () => {
    // hashToken helper must use genericHash for the hash
    expect(serviceSource).toContain("adapter.genericHash(GENERIC_HASH_BYTES_MAX, tokenBytes)");
  });
});

describe("session auth timing safety (structural verification)", () => {
  const sessionAuthPath = resolve(import.meta.dirname, "../../lib/session-auth.ts");
  const sessionAuthSource = readFileSync(sessionAuthPath, "utf8");

  it("hashes the session token before DB lookup", () => {
    expect(sessionAuthSource).toContain("hashSessionToken");
  });

  it("uses DB WHERE clause for session lookup", () => {
    expect(sessionAuthSource).toContain("eq(sessions.tokenHash");
  });
});
