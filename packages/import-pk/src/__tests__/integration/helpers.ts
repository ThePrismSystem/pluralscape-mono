/**
 * Integration test helpers for import-pk.
 *
 * Builds `FakeSourceData` from fixture arrays so `createFakeImportSource`
 * can feed them into the import engine.
 */
import type { FakeSourceData } from "@pluralscape/import-core/testing";

interface PrivacyScanMember {
  readonly pkMemberId: string;
  readonly privacy?: Record<string, string>;
}

interface HasId {
  readonly id: string;
  readonly [key: string]: unknown;
}

interface FixtureShape {
  readonly members: readonly HasId[];
  readonly groups: readonly HasId[];
  readonly switches: readonly HasId[];
  readonly privacyScanMembers: readonly PrivacyScanMember[];
}

/**
 * Transform fixture arrays into the `FakeSourceData` shape expected by
 * `createFakeImportSource`. Each document needs an `_id` field that the
 * fake source uses as `sourceId`.
 */
export function buildFakeSourceData(fixture: FixtureShape): FakeSourceData {
  return {
    member: fixture.members.map((m) => ({ _id: m.id, ...m })),
    group: fixture.groups.map((g) => ({ _id: g.id, ...g })),
    switch: fixture.switches.map((s, i) => ({ _id: `switch-${String(i)}`, ...s })),
    "privacy-bucket": [
      {
        _id: "synthetic-privacy-scan",
        type: "privacy-scan",
        members: fixture.privacyScanMembers,
      },
    ],
  };
}
