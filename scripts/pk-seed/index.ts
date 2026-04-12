/**
 * PK Test Data Seeding Script
 *
 * Usage:
 *   tsx scripts/pk-seed/index.ts <minimal|adversarial>
 *
 * Environment variables:
 *   PK_TOKEN_MINIMAL      — PK system token for minimal mode
 *   PK_TOKEN_ADVERSARIAL  — PK system token for adversarial mode
 *   PK_API_BASE_URL       — Override PK API base URL (default: https://api.pluralkit.me)
 *
 * PK does not support programmatic system creation via its public API.
 * You must create a system manually (e.g., via the PK Discord bot) and
 * supply the token. The token is persisted in the manifest for subsequent runs.
 */

import process from "node:process";
import { PkClient } from "./client.js";
import type { Manifest } from "./manifest.js";
import { loadManifest, emptyManifest, writeManifestAtomic, planSeed } from "./manifest.js";
import { executePlan, resolveRefs } from "./seed.js";
import { MINIMAL_FIXTURES } from "./fixtures/minimal.js";
import { ADVERSARIAL_FIXTURES } from "./fixtures/adversarial.js";
import type { PkMode } from "./constants.js";
import { PK_API_BASE_URL_DEFAULT } from "./constants.js";
import type { EntityFixtures } from "./fixtures/types.js";

const FIXTURES: Record<PkMode, EntityFixtures> = {
  minimal: MINIMAL_FIXTURES,
  adversarial: ADVERSARIAL_FIXTURES,
};

function resolveToken(mode: PkMode, existing: Manifest | undefined): string {
  // Check manifest first
  if (existing?.token) return existing.token;

  // Check environment variables
  const envKey = `PK_TOKEN_${mode.toUpperCase()}`;
  const envToken = process.env[envKey];
  if (envToken) return envToken;

  throw new Error(
    `no PK token for ${mode} mode — ` +
      `set ${envKey} env var or run the script once with the env var set. ` +
      `Create a PK system via the PK Discord bot to get a token.`,
  );
}

async function seedMode(mode: PkMode, baseUrl: string): Promise<void> {
  console.log(`\n=== Seeding PK system: ${mode} ===\n`);

  const fixtures = FIXTURES[mode];
  const existing = loadManifest(mode);

  // Step 1: Resolve and verify token
  const token = resolveToken(mode, existing);
  const client = new PkClient(token, baseUrl);

  const systemId = await client.verifyToken();
  if (!systemId) {
    throw new Error(
      `PK token for ${mode} mode is invalid (401). ` +
        `Delete the manifest and re-run with a valid PK_TOKEN_${mode.toUpperCase()} env var.`,
    );
  }
  console.log(`  System ID: ${systemId}`);

  // Step 2: Write skeleton manifest
  const skeleton = existing ?? emptyManifest(token, systemId, mode);
  writeManifestAtomic(mode, { ...skeleton, token, systemId });

  // Step 3: Plan seed
  const plan = await planSeed(client, fixtures, existing);
  console.log(`  Plan: ${plan.reuse.length} reused, ${plan.create.length} to create`);

  // Step 4: Execute
  const refMap = new Map<string, string>();
  for (const r of plan.reuse) refMap.set(r.ref, r.sourceId);

  await executePlan(client, token, systemId, mode, fixtures, plan, refMap);

  // Step 5: Apply system-level patch if specified
  if (fixtures.systemPatch) {
    console.log("  Applying system patch...");
    await client.request("/v2/systems/@me", {
      method: "PATCH",
      body: fixtures.systemPatch,
    });
  }

  console.log(`\n  ${mode} mode complete.\n`);
}

async function main(): Promise<void> {
  const mode = process.argv[2] as PkMode | undefined;
  if (!mode || !["minimal", "adversarial"].includes(mode)) {
    console.error("Usage: tsx scripts/pk-seed/index.ts <minimal|adversarial>");
    process.exit(1);
  }

  const baseUrl = process.env["PK_API_BASE_URL"] ?? PK_API_BASE_URL_DEFAULT;

  console.log("PK Test Data Seeding Script");
  console.log("===========================");
  console.log(`PK API base: ${baseUrl}`);

  await seedMode(mode, baseUrl);

  console.log("=== Done ===");
  console.log(`Manifest: scripts/.pk-seed-${mode}-manifest.json`);
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
