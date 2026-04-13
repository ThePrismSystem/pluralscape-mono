/**
 * Manifest persistence for PK seed idempotency.
 *
 * Follows the same pattern as scripts/sp-seed/manifest.ts:
 * - loadManifest: reads JSON from disk, validates, returns typed or undefined
 * - writeManifestAtomic: write to .tmp, rename atomically
 * - planSeed: compare fixtures against manifest, probe API, return reuse/create
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import type { PkMode, EntityTypeKey } from "./constants.js";
import { ENTITY_TYPES_IN_ORDER, PATHS } from "./constants.js";
import { LegacyManifestError, PkApiError } from "./client.js";
import type { PkClient } from "./client.js";
import type {
  EntityFixtures,
  MemberFixtureDef,
  GroupFixtureDef,
  SwitchFixtureDef,
} from "./fixtures/types.js";

export interface ManifestEntry {
  readonly ref: string;
  readonly sourceId: string;
  readonly fields: Record<string, unknown>;
}

export interface Manifest {
  readonly token: string;
  readonly systemId: string;
  readonly mode: PkMode;
  readonly members: ManifestEntry[];
  readonly groups: ManifestEntry[];
  readonly switches: ManifestEntry[];
}

export function emptyManifest(token: string, systemId: string, mode: PkMode): Manifest {
  return { token, systemId, mode, members: [], groups: [], switches: [] };
}

export function loadManifest(mode: PkMode): Manifest | undefined {
  const path = PATHS.manifest(mode);
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as Manifest;
  // Validate — every entry in every array must have a `ref` field.
  for (const entityType of ENTITY_TYPES_IN_ORDER) {
    for (const entry of parsed[entityType]) {
      if (typeof (entry as ManifestEntry).ref !== "string") {
        throw new LegacyManifestError(path);
      }
    }
  }
  return parsed;
}

export function writeManifestAtomic(mode: PkMode, manifest: Manifest): void {
  const path = PATHS.manifest(mode);
  const tmpPath = `${path}.tmp`;
  const content = JSON.stringify(manifest, null, 2) + "\n";
  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, path);
}

// --- Seed planning ---

export interface SeedPlanReuseEntry {
  readonly entityType: EntityTypeKey;
  readonly ref: string;
  readonly sourceId: string;
  readonly fields: Record<string, unknown>;
}

export interface SeedPlanCreateEntry {
  readonly entityType: EntityTypeKey;
  readonly ref: string;
}

export interface SeedPlan {
  readonly reuse: readonly SeedPlanReuseEntry[];
  readonly create: readonly SeedPlanCreateEntry[];
}

/** PK API probe paths by entity type. */
const PROBE_PATHS: Record<EntityTypeKey, (sourceId: string) => string> = {
  members: (id) => `/v2/members/${id}`,
  groups: (id) => `/v2/groups/${id}`,
  switches: (_id) => `/v2/systems/@me/switches`,
};

/**
 * Compare fixtures against manifest entries. For each fixture ref:
 * - If manifest has an entry and the API confirms it still exists, reuse it.
 * - Otherwise, mark it for creation.
 *
 * Switches are treated specially: they are not individually probe-able by ID in
 * the PK API, so we trust the manifest if it has an entry. If the manifest is
 * empty or missing entries, we re-create all switches.
 */
export async function planSeed(
  client: PkClient,
  fixtures: EntityFixtures,
  existing: Manifest | undefined,
): Promise<SeedPlan> {
  const reuse: SeedPlanReuseEntry[] = [];
  const create: SeedPlanCreateEntry[] = [];
  const existingByRef = buildRefIndex(existing);

  for (const entityType of ENTITY_TYPES_IN_ORDER) {
    const fixtureArray = getFixtureArray(fixtures, entityType);
    for (const entry of fixtureArray) {
      const ref = getRef(entry);
      const existingEntry = existingByRef.get(ref);

      if (!existingEntry || existingEntry.entityType !== entityType) {
        create.push({ entityType, ref });
        continue;
      }

      // For switches, trust manifest — PK doesn't expose individual switch GET.
      if (entityType === "switches") {
        reuse.push({
          entityType,
          ref,
          sourceId: existingEntry.entry.sourceId,
          fields: existingEntry.entry.fields,
        });
        continue;
      }

      const probePath = PROBE_PATHS[entityType](existingEntry.entry.sourceId);
      try {
        const exists = await client.probe(probePath);
        if (exists) {
          reuse.push({
            entityType,
            ref,
            sourceId: existingEntry.entry.sourceId,
            fields: existingEntry.entry.fields,
          });
        } else {
          create.push({ entityType, ref });
        }
      } catch (err) {
        if (err instanceof PkApiError && err.status === 401) {
          throw err;
        }
        create.push({ entityType, ref });
      }
    }
  }

  return { reuse, create };
}

function getFixtureArray(
  fixtures: EntityFixtures,
  entityType: EntityTypeKey,
): readonly (MemberFixtureDef | GroupFixtureDef | SwitchFixtureDef)[] {
  return fixtures[entityType];
}

function getRef(entry: MemberFixtureDef | GroupFixtureDef | SwitchFixtureDef): string {
  return entry.ref;
}

function buildRefIndex(
  manifest: Manifest | undefined,
): Map<string, { entityType: EntityTypeKey; entry: ManifestEntry }> {
  const out = new Map<string, { entityType: EntityTypeKey; entry: ManifestEntry }>();
  if (!manifest) return out;
  for (const entityType of ENTITY_TYPES_IN_ORDER) {
    for (const entry of manifest[entityType]) {
      if (out.has(entry.ref)) {
        throw new Error(`duplicate ref "${entry.ref}" in manifest`);
      }
      out.set(entry.ref, { entityType, entry });
    }
  }
  return out;
}
