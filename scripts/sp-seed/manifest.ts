// scripts/sp-seed/manifest.ts
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import type { SpMode } from "./constants.js";
import { ENTITY_PROBE_PATHS, PATHS } from "./constants.js";
import type { EntityFixtures, FixtureDef } from "./fixtures/types.js";
import type { EntityTypeKey } from "./fixtures/types.js";
import { ENTITY_TYPES_IN_ORDER } from "./fixtures/types.js";
import { LegacyManifestError, SpApiError } from "./client.js";

export interface ManifestEntry {
  readonly ref: string;
  readonly sourceId: string;
  readonly fields: Record<string, unknown>;
}

export type Manifest = {
  readonly systemId: string;
  readonly mode: SpMode;
} & {
  readonly [K in EntityTypeKey]: readonly ManifestEntry[];
};

export function emptyManifest(systemId: string, mode: SpMode): Manifest {
  return {
    systemId,
    mode,
    privacyBuckets: [],
    customFields: [],
    customFronts: [],
    members: [],
    groups: [],
    frontHistory: [],
    comments: [],
    notes: [],
    polls: [],
    channelCategories: [],
    channels: [],
    chatMessages: [],
    boardMessages: [],
  };
}

export function loadManifest(mode: SpMode): Manifest | undefined {
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

export function writeManifestAtomic(mode: SpMode, manifest: Manifest): void {
  const path = PATHS.manifest(mode);
  const tmpPath = `${path}.tmp`;
  const content = JSON.stringify(manifest, null, 2) + "\n";
  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, path);
}

export interface SeedPlanReuseEntry {
  readonly entityType: EntityTypeKey;
  readonly ref: string;
  readonly sourceId: string;
  readonly fields: Record<string, unknown>;
}

export interface SeedPlanCreateEntry {
  readonly entityType: EntityTypeKey;
  readonly ref: string;
  readonly body: unknown;
}

export interface SeedPlan {
  readonly reuse: readonly SeedPlanReuseEntry[];
  readonly create: readonly SeedPlanCreateEntry[];
}

interface MinimalClient {
  request(path: string, opts?: { method?: string }): Promise<unknown>;
}

export async function planSeed(
  client: MinimalClient,
  systemId: string,
  fixtures: EntityFixtures,
  existing: Manifest | undefined,
): Promise<SeedPlan> {
  const reuse: SeedPlanReuseEntry[] = [];
  const create: SeedPlanCreateEntry[] = [];
  const existingByRef = buildRefIndex(existing);
  for (const entityType of ENTITY_TYPES_IN_ORDER) {
    const fixtureArray = fixtures[entityType] as readonly FixtureDef<unknown>[];
    for (const entry of fixtureArray) {
      const existingEntry = existingByRef.get(entry.ref);
      if (!existingEntry || existingEntry.entityType !== entityType) {
        create.push({ entityType, ref: entry.ref, body: entry.body });
        continue;
      }
      const probePath = ENTITY_PROBE_PATHS[entityType](systemId, existingEntry.entry.sourceId);
      try {
        await client.request(probePath, {});
        reuse.push({
          entityType,
          ref: entry.ref,
          sourceId: existingEntry.entry.sourceId,
          fields: existingEntry.entry.fields,
        });
      } catch (err) {
        if (err instanceof SpApiError && err.status === 401) {
          throw err;
        }
        if (err instanceof SpApiError && (err.status === 404 || err.status === 403)) {
          create.push({ entityType, ref: entry.ref, body: entry.body });
          continue;
        }
        throw err;
      }
    }
  }
  return { reuse, create };
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
