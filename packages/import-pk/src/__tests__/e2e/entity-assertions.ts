/**
 * E2E entity assertion helpers for verifying imported PK data.
 *
 * Each function looks up Pluralscape entity IDs via `importEntityRef.lookupBatch`,
 * fetches entities via tRPC `.get` endpoints, decrypts `encryptedData` using
 * transforms from `@pluralscape/data`, and asserts that mapped fields match
 * the fixture expectations.
 */
import {
  decodeAndDecryptT1,
  decryptFrontingSession,
  decryptGroup,
  decryptMember,
} from "@pluralscape/data";
import { lookupRefs, requireRef } from "@pluralscape/test-utils/e2e";
import { expect } from "vitest";

import type { TRPCClient } from "./e2e-helpers.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { SystemId } from "@pluralscape/types";

const SOURCE = "pluralkit" as const;

// ── Assertion helpers ──────────────────────────────────────────────────

export async function assertPkMembers(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  expected: readonly { sourceId: string; name: string }[],
): Promise<void> {
  const refs = await lookupRefs(
    trpc,
    systemId,
    SOURCE,
    "member",
    expected.map((e) => e.sourceId),
  );

  for (const entry of expected) {
    const memberId = requireRef(refs, entry.sourceId, `member:${entry.sourceId}`);
    const raw = await trpc.member.get.query({ systemId, memberId });
    const decrypted = decryptMember(raw, masterKey);

    expect(decrypted.name, `member ${entry.sourceId}: name`).toBe(entry.name);
  }
}

export async function assertPkGroups(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  expected: readonly { sourceId: string; name: string }[],
): Promise<void> {
  const refs = await lookupRefs(
    trpc,
    systemId,
    SOURCE,
    "group",
    expected.map((e) => e.sourceId),
  );

  for (const entry of expected) {
    const groupId = requireRef(refs, entry.sourceId, `group:${entry.sourceId}`);
    const raw = await trpc.group.get.query({ systemId, groupId });
    const decrypted = decryptGroup(raw, masterKey);

    expect(decrypted.name, `group ${entry.sourceId}: name`).toBe(entry.name);
  }
}

export async function assertPkFrontingSessions(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  expectedCount: number,
  sessionSourceIds: readonly string[],
): Promise<void> {
  const refs = await lookupRefs(trpc, systemId, SOURCE, "fronting-session", sessionSourceIds);

  expect(Object.keys(refs).length, "fronting session ref count").toBe(expectedCount);

  for (const sourceId of sessionSourceIds) {
    const sessionId = requireRef(refs, sourceId, `fronting-session:${sourceId}`);
    const raw = await trpc.frontingSession.get.query({ systemId, sessionId });
    const decrypted = decryptFrontingSession(raw, masterKey);

    // Verify the session was stored with a valid startTime
    expect(decrypted.startTime, `session ${sourceId}: startTime is a number`).toEqual(
      expect.any(Number),
    );
  }
}

export async function assertPkPrivacyBuckets(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  expected: readonly { sourceId: string; name: string }[],
): Promise<void> {
  const refs = await lookupRefs(
    trpc,
    systemId,
    SOURCE,
    "privacy-bucket",
    expected.map((e) => e.sourceId),
  );

  for (const entry of expected) {
    const bucketId = requireRef(refs, entry.sourceId, `privacy-bucket:${entry.sourceId}`);
    const raw = await trpc.bucket.get.query({ systemId, bucketId });
    const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey) as Record<string, unknown>;

    expect(decrypted["name"], `bucket ${entry.sourceId}: name`).toBe(entry.name);
  }
}
