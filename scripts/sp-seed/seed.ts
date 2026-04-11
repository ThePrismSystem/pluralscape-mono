import { UnresolvedRefError, SpApiError, extractObjectIdFromText, SpClient } from "./client.js";
import type { Manifest, ManifestEntry, SeedPlan } from "./manifest.js";
import { writeManifestAtomic, loadManifest, emptyManifest, planSeed } from "./manifest.js";
import type { EntityFixtures, EntityTypeKey, FixtureDef } from "./fixtures/types.js";
import { ENTITY_TYPES_IN_ORDER } from "./fixtures/types.js";
import { ENTITY_CREATION_DELAY_MS, ENTITY_POST_PATHS, PATHS } from "./constants.js";
import type { SpMode } from "./constants.js";
import { writeEnvFile } from "./env.js";
import type { SpTestEnv, SpModeEnv } from "./env.js";

/**
 * Walk a POST body object and replace any `FixtureRef`-shaped string values
 * with the corresponding server-side ObjectId from `refMap`.
 *
 * A "ref-shaped" string is any string matching the convention
 * `<entityType>.<name>` (lowercase letters, digits, and hyphens, exactly one dot).
 * Non-matching strings pass through untouched. Nested objects recurse; arrays of
 * strings check each element.
 *
 * Throws `UnresolvedRefError` if a ref-shaped string is encountered that is not
 * in the map — this catches fixture ordering bugs before any network call.
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
  // Ref convention: "<entityType>.<name>" — lowercase letters, digits, hyphens with EXACTLY ONE dot.
  // Real SP field values (member names, descriptions, etc.) will not match because they
  // typically contain spaces, capitals, multiple dots, or special characters.
  if (!/^[a-z][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/.test(s)) return s;
  const resolved = refMap.get(s);
  if (resolved === undefined) throw new UnresolvedRefError(s);
  return resolved;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Minimum client interface used by triggerExportWith429Handling — enables stub-friendly tests. */
interface ExportCapableClient {
  request(path: string, opts: { method?: string; body?: unknown }): Promise<unknown>;
}

/**
 * Triggers the SP server-side export email. Catches 429 (rate-limited by SP's
 * 5-minute cooldown) and logs a warning without throwing — the export is a
 * side-effect notification, not a required step.
 */
export async function triggerExportWith429Handling(
  client: ExportCapableClient,
  systemId: string,
): Promise<void> {
  console.log("  Triggering SP data export (check your email for the JSON)...");
  try {
    await client.request(`/v1/user/${systemId}/export`, {
      method: "POST",
      body: {},
    });
    console.log(
      "  Export triggered — download the JSON from the email and save to " +
        "scripts/.sp-test-<mode>-export.json",
    );
  } catch (err) {
    if (err instanceof SpApiError && err.status === 429) {
      console.warn(
        `  Export skipped — rate-limited by SP (${err.body}). ` +
          `Re-run after the 5-minute cooldown if you need a fresh export.`,
      );
      return;
    }
    throw err;
  }
}

/** Mutable internal manifest shape used during seed execution. */
type WritableManifest = {
  systemId: string;
  mode: SpMode;
} & {
  [K in EntityTypeKey]: ManifestEntry[];
};

/**
 * Execute a SeedPlan: hydrate `refMap` from reuses, then POST each `create`
 * entry in order, persisting the manifest atomically after each success.
 * Returns the fully-populated manifest.
 */
export async function executePlan(
  client: SpClient,
  systemId: string,
  mode: SpMode,
  fixtures: EntityFixtures,
  plan: SeedPlan,
  refMap: Map<string, string>,
): Promise<Manifest> {
  const working = buildWorkingManifest(systemId, mode, plan.reuse, fixtures);
  writeManifestAtomic(mode, working as Manifest);

  for (const entry of plan.create) {
    const fixtureEntry = findFixtureEntry(fixtures, entry.entityType, entry.ref);
    const resolvedBody = resolveRefs(fixtureEntry.body, refMap);
    const postPath = ENTITY_POST_PATHS[entry.entityType];
    const rawId = await client.requestRaw(postPath, {
      method: "POST",
      body: resolvedBody,
    });
    const sourceId = extractObjectIdFromText(rawId);
    refMap.set(entry.ref, sourceId);
    const manifestEntry: ManifestEntry = {
      ref: entry.ref,
      sourceId,
      fields: resolvedBody as Record<string, unknown>,
    };
    working[entry.entityType].push(manifestEntry);
    writeManifestAtomic(mode, working as Manifest);
    await sleep(ENTITY_CREATION_DELAY_MS);
  }

  return working as Manifest;
}

function buildWorkingManifest(
  systemId: string,
  mode: SpMode,
  reuse: SeedPlan["reuse"],
  fixtures: EntityFixtures,
): WritableManifest {
  const working: WritableManifest = {
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
  // Preserve reuses in their fixture-order so the manifest stays stable.
  const reuseIndex = new Map<string, SeedPlan["reuse"][number]>();
  for (const r of reuse) reuseIndex.set(r.ref, r);
  for (const entityType of ENTITY_TYPES_IN_ORDER) {
    for (const fixture of fixtures[entityType]) {
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

function findFixtureEntry(
  fixtures: EntityFixtures,
  entityType: EntityTypeKey,
  ref: string,
): FixtureDef<unknown> {
  const arr = fixtures[entityType] as readonly FixtureDef<unknown>[];
  const found = arr.find((f) => f.ref === ref);
  if (!found) {
    throw new Error(`fixture not found: entityType=${entityType} ref=${ref}`);
  }
  return found;
}

export interface ModeCreds {
  readonly email: string;
  readonly password: string;
}

export async function seedMode(
  mode: SpMode,
  creds: ModeCreds,
  fixtures: EntityFixtures,
  env: SpTestEnv,
  baseUrl: string,
): Promise<void> {
  console.log(`\n=== Seeding ${mode} mode ===`);

  const { client, systemId, apiKey, fresh } = await SpClient.bootstrap(
    creds.email,
    creds.password,
    env[mode].apiKey,
    baseUrl,
  );
  console.log(fresh ? "  Fresh bootstrap — created new API key" : "  Reusing stored API key");
  console.log(`  System ID: ${systemId}`);

  const existing = loadManifest(mode);
  // Write skeleton first so even a planSeed crash leaves parseable state.
  writeManifestAtomic(mode, existing ?? emptyManifest(systemId, mode));

  const plan = await planSeed(client, systemId, fixtures, existing);
  console.log(`  Plan: ${plan.reuse.length} reused, ${plan.create.length} to create`);

  const refMap = new Map<string, string>();
  for (const r of plan.reuse) refMap.set(r.ref, r.sourceId);

  await executePlan(client, systemId, mode, fixtures, plan, refMap);

  // Apply final profile patch
  await client.request<unknown>(`/v1/user/${systemId}`, {
    method: "PATCH",
    body: fixtures.profilePatch,
  });

  // Trigger export (handles 429 gracefully)
  await triggerExportWith429Handling(client, systemId);

  // Persist env
  const modeEnv: SpModeEnv = {
    email: creds.email,
    password: creds.password,
    apiKey,
    systemId,
    manifestPath: PATHS.manifest(mode),
    exportJsonPath: PATHS.exportJson(mode),
  };
  env[mode] = modeEnv;
  writeEnvFile(env);

  console.log(`  ${mode} mode complete.`);
}
