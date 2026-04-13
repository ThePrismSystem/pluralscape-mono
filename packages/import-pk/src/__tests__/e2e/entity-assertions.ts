/**
 * E2E entity assertion helpers for verifying imported PK data.
 *
 * Each function looks up Pluralscape entity IDs via `importEntityRef.lookupBatch`,
 * fetches entities via tRPC `.get` endpoints, decrypts `encryptedData` using
 * transforms from `@pluralscape/data`, and asserts that mapped fields match
 * the manifest expectations.
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
import type { PkManifest, PkManifestEntry } from "../integration/manifest.types.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { SystemId } from "@pluralscape/types";

const SOURCE = "pluralkit" as const;

// ── Ref lookup wrapper ──────────────────────────────────────────────

async function lookupPkRefs(
  trpc: TRPCClient,
  systemId: SystemId,
  sourceEntityType: Parameters<typeof lookupRefs>[3],
  entries: readonly PkManifestEntry[],
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

    expect(decrypted.name, `${entry.ref}: name`).toBe(entry.fields["name"]);
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

    expect(decrypted.name, `${entry.ref}: name`).toBe(entry.fields["name"]);
  }
}

export async function assertPkFrontingSessions(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: PkManifest,
): Promise<void> {
  // PK switches map to fronting sessions with synthetic source IDs
  // (`session:<memberId>:<startTimeMs>`). We can't predict these from
  // the manifest. Instead, list sessions and verify:
  // 1. Count >= switch count (co-fronts produce multiple sessions per switch)
  // 2. Every session has a valid decryptable startTime
  const page = await trpc.frontingSession.list.query({ systemId, limit: 100 });
  const sessions = page.data;
  expect(
    sessions.length,
    "fronting session count should be >= switch count",
  ).toBeGreaterThanOrEqual(manifest.switches.length);

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
  // PK synthesizes a single "PK Private" bucket. The manifest doesn't
  // track it (it's synthetic), so we look it up by its well-known source ID.
  const refs = await lookupPkRefs(trpc, systemId, "privacy-bucket", [
    {
      ref: "synthetic:pk-private",
      sourceId: "synthetic:pk-private",
      fields: { name: "PK Private" },
    },
  ]);

  const bucketId = requireRef(refs, "synthetic:pk-private", "privacy-bucket:synthetic:pk-private");
  const raw = await trpc.bucket.get.query({ systemId, bucketId });
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey) as Record<string, unknown>;

  expect(decrypted["name"], "PK Private bucket name").toBe("PK Private");
}
