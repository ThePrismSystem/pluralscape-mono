// scripts/sp-seed/manifest.ts
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import type { SpMode } from "./constants.js";
import type { EntityTypeKey } from "./fixtures/types.js";
import { ENTITY_TYPES_IN_ORDER } from "./fixtures/types.js";
import { LegacyManifestError } from "./client.js";
import { PATHS } from "./constants.js";

export interface ManifestEntry {
  readonly ref: string;
  readonly sourceId: string;
  readonly fields: Record<string, unknown>;
}

export type Manifest = {
  readonly systemId: string;
  readonly mode: SpMode;
} & {
  readonly [K in EntityTypeKey]: ManifestEntry[];
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
