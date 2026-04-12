/**
 * PK seed execution logic.
 *
 * Resolves refs, creates entities in dependency order (members -> groups -> switches),
 * and persists the manifest atomically after each successful creation.
 */

import { UnresolvedRefError, PkClient } from "./client.js";
import type { Manifest, ManifestEntry, SeedPlan } from "./manifest.js";
import { writeManifestAtomic } from "./manifest.js";
import type { PkMode, EntityTypeKey } from "./constants.js";
import { ENTITY_TYPES_IN_ORDER, ONE_DAY_MS } from "./constants.js";
import type { EntityFixtures } from "./fixtures/types.js";

/**
 * Walk a value and replace any ref-shaped string with its resolved server-side ID.
 *
 * A "ref-shaped" string matches `<entityType>.<name>` (lowercase letters, digits,
 * and hyphens, exactly one dot). Non-matching strings pass through untouched.
 */
export function resolveRefs<T>(body: T, refMap: ReadonlyMap<string, string>): T {
  return resolveValue(body, refMap) as T;
}

function resolveValue(value: unknown, refMap: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") {
    return resolveMaybeRef(value, refMap);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, refMap));
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveValue(v, refMap);
    }
    return out;
  }
  return value;
}

function resolveMaybeRef(s: string, refMap: ReadonlyMap<string, string>): string {
  if (!/^[a-z][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/.test(s)) return s;
  const resolved = refMap.get(s);
  if (resolved === undefined) throw new UnresolvedRefError(s);
  return resolved;
}

/** Resolve a switch timestamp: negative numbers are day offsets from now. */
function resolveTimestamp(ts: number | string): string {
  if (typeof ts === "string") return ts;
  if (ts <= 0) {
    return new Date(Date.now() + ts * ONE_DAY_MS).toISOString();
  }
  return new Date(ts).toISOString();
}

interface WritableManifest {
  token: string;
  systemId: string;
  mode: PkMode;
  members: ManifestEntry[];
  groups: ManifestEntry[];
  switches: ManifestEntry[];
}

/**
 * Execute a SeedPlan: hydrate refMap from reuses, then create each entity
 * in order, persisting the manifest atomically after each success.
 */
export async function executePlan(
  client: PkClient,
  token: string,
  systemId: string,
  mode: PkMode,
  fixtures: EntityFixtures,
  plan: SeedPlan,
  refMap: Map<string, string>,
): Promise<Manifest> {
  const working = buildWorkingManifest(token, systemId, mode, plan.reuse, fixtures);
  writeManifestAtomic(mode, working as Manifest);

  for (const entry of plan.create) {
    const sourceId = await createEntity(client, fixtures, entry, refMap);
    refMap.set(entry.ref, sourceId);

    const manifestEntry: ManifestEntry = {
      ref: entry.ref,
      sourceId,
      fields: {},
    };
    working[entry.entityType].push(manifestEntry);
    writeManifestAtomic(mode, working as Manifest);
  }

  return working as Manifest;
}

async function createEntity(
  client: PkClient,
  fixtures: EntityFixtures,
  entry: { entityType: EntityTypeKey; ref: string },
  refMap: ReadonlyMap<string, string>,
): Promise<string> {
  switch (entry.entityType) {
    case "members":
      return createMember(client, fixtures, entry.ref, refMap);
    case "groups":
      return createGroup(client, fixtures, entry.ref, refMap);
    case "switches":
      return createSwitch(client, fixtures, entry.ref, refMap);
    default: {
      const _exhaustive: never = entry.entityType;
      throw new Error(`unknown entity type: ${String(_exhaustive)}`);
    }
  }
}

async function createMember(
  client: PkClient,
  fixtures: EntityFixtures,
  ref: string,
  _refMap: ReadonlyMap<string, string>,
): Promise<string> {
  const fixture = fixtures.members.find((m) => m.ref === ref);
  if (!fixture) throw new Error(`member fixture not found: ${ref}`);

  const result = await client.createMember({ ...fixture.body });
  const memberId = result.id;

  // Apply privacy settings if specified
  if (fixture.privacy) {
    await client.patchMember(memberId, { privacy: fixture.privacy });
  }

  return memberId;
}

async function createGroup(
  client: PkClient,
  fixtures: EntityFixtures,
  ref: string,
  refMap: ReadonlyMap<string, string>,
): Promise<string> {
  const fixture = fixtures.groups.find((g) => g.ref === ref);
  if (!fixture) throw new Error(`group fixture not found: ${ref}`);

  const result = await client.createGroup({ ...fixture.body });
  const groupId = result.id;

  // Add members to group
  if (fixture.members.length > 0) {
    const resolvedMemberIds = fixture.members.map((memberRef) => {
      const resolved = refMap.get(memberRef);
      if (!resolved) throw new UnresolvedRefError(memberRef);
      return resolved;
    });
    await client.addGroupMembers(groupId, resolvedMemberIds);
  }

  return groupId;
}

async function createSwitch(
  client: PkClient,
  fixtures: EntityFixtures,
  ref: string,
  refMap: ReadonlyMap<string, string>,
): Promise<string> {
  const fixture = fixtures.switches.find((s) => s.ref === ref);
  if (!fixture) throw new Error(`switch fixture not found: ${ref}`);

  const resolvedMembers = fixture.members.map((memberRef) => {
    // Empty member arrays are valid (switch-out)
    const resolved = refMap.get(memberRef);
    if (!resolved) throw new UnresolvedRefError(memberRef);
    return resolved;
  });

  const timestamp = resolveTimestamp(fixture.timestamp);
  const result = await client.createSwitch({ members: resolvedMembers, timestamp });
  return result.id;
}

function buildWorkingManifest(
  token: string,
  systemId: string,
  mode: PkMode,
  reuse: SeedPlan["reuse"],
  fixtures: EntityFixtures,
): WritableManifest {
  const working: WritableManifest = {
    token,
    systemId,
    mode,
    members: [],
    groups: [],
    switches: [],
  };

  // Preserve reuses in fixture order for stable manifests.
  const reuseIndex = new Map<string, SeedPlan["reuse"][number]>();
  for (const r of reuse) reuseIndex.set(r.ref, r);

  for (const entityType of ENTITY_TYPES_IN_ORDER) {
    const fixtureArray = fixtures[entityType];
    for (const fixture of fixtureArray) {
      const r = reuseIndex.get(fixture.ref);
      if (r && r.entityType === entityType) {
        working[entityType].push({
          ref: r.ref,
          sourceId: r.sourceId,
          fields: r.fields,
        });
      }
    }
  }

  return working;
}
