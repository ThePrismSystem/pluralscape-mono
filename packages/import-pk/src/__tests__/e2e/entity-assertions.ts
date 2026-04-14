/**
 * E2E entity assertion helpers for verifying imported PK data.
 *
 * Each function looks up Pluralscape entity IDs via `importEntityRef.lookupBatch`,
 * fetches entities via tRPC `.get` endpoints, decrypts `encryptedData` using
 * transforms from `@pluralscape/data`, and asserts that mapped fields match
 * the manifest expectations.
 */
import {
  decryptFrontingSession,
  decryptGroup,
  decryptMember,
  decryptPrivacyBucket,
} from "@pluralscape/data";
import { lookupRefs, requireRef } from "@pluralscape/test-utils/e2e";
import { expect } from "vitest";

import type { TRPCClient } from "./e2e-helpers.js";
import type { PkManifest, PkManifestEntry } from "../integration/manifest.types.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { SystemId } from "@pluralscape/types";

const SOURCE = "pluralkit" as const;

// ── Ref lookup wrapper ──────────────────────────────────────────────

async function lookupPkRefs<F>(
  trpc: TRPCClient,
  systemId: SystemId,
  sourceEntityType: Parameters<typeof lookupRefs>[3],
  entries: readonly PkManifestEntry<F>[],
): Promise<Record<string, string>> {
  if (entries.length === 0) return {};
  return lookupRefs(
    trpc,
    systemId,
    SOURCE,
    sourceEntityType,
    entries.map((e) => e.sourceId),
  );
}

// ── Per-entity-type assertions ──────────────────────────────────────

export async function assertPkMembers(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: PkManifest,
): Promise<void> {
  const refs = await lookupPkRefs(trpc, systemId, "member", manifest.members);

  for (const entry of manifest.members) {
    const memberId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.member.get.query({ systemId, memberId });
    const decrypted = decryptMember(raw, masterKey);

    expect(decrypted.name, `${entry.ref}: name`).toBe(entry.fields.name);
  }
}

export async function assertPkGroups(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: PkManifest,
): Promise<void> {
  const refs = await lookupPkRefs(trpc, systemId, "group", manifest.groups);

  for (const entry of manifest.groups) {
    const groupId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.group.get.query({ systemId, groupId });
    const decrypted = decryptGroup(raw, masterKey);

    expect(decrypted.name, `${entry.ref}: name`).toBe(entry.fields.name);
  }
}

export async function assertPkFrontingSessions(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: PkManifest,
): Promise<void> {
  // PK switches are snapshots of who is fronting — the mapper diffs
  // consecutive snapshots to derive per-member sessions. The expected count
  // is computed by the seed script using the same mapper logic and stored
  // in the manifest.
  const page = await trpc.frontingSession.list.query({ systemId, limit: 100 });
  const sessions = page.data;
  expect(sessions.length, "fronting session count").toBe(manifest.expectedSessionCount);

  for (const session of sessions) {
    const decrypted = decryptFrontingSession(session, masterKey);
    expect(decrypted.startTime, "session startTime is a number").toEqual(expect.any(Number));
  }
}

export async function assertPkPrivacyBuckets(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
): Promise<void> {
  // PK synthesizes a "PK Private" bucket only when at least one member
  // has a privacy field set to "private". Not all exports have private
  // members (e.g. the adversarial seed has none), so we check whether
  // the ref exists before asserting content.
  const result = await trpc.importEntityRef.lookupBatch.mutate({
    systemId,
    source: SOURCE,
    sourceEntityType: "privacy-bucket",
    sourceEntityIds: ["synthetic:pk-private"],
  });

  const bucketId = result["synthetic:pk-private"];
  if (bucketId === undefined) {
    // No bucket was synthesized — valid for exports without private members.
    return;
  }

  const raw = await trpc.bucket.get.query({ systemId, bucketId });
  const decrypted = decryptPrivacyBucket(raw, masterKey);

  expect(decrypted.name, "PK Private bucket name").toBe("PK Private");
}
