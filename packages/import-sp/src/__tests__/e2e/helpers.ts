import { readFile } from "node:fs/promises";
import path from "node:path";

import { emptyCheckpointState } from "../../engine/checkpoint.js";
import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { createApiImportSource } from "../../sources/api-source.js";
import { createFileImportSource } from "../../sources/file-source.js";

import type { Manifest, ManifestCollectionKey } from "./manifest.types.js";
import type { ImportDataSource } from "../../sources/source.types.js";
import type { ImportCheckpointState, ImportCollectionType } from "@pluralscape/types";

const MONOREPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");

const SP_API_BASE_URL = "https://api.apparyllis.com";

/**
 * Maps manifest collection keys (camelCase plural) to
 * `ImportCollectionType` values used by the engine.
 */
export const COLLECTION_TO_ENTITY_TYPE: Record<ManifestCollectionKey, ImportCollectionType> = {
  privacyBuckets: "privacy-bucket",
  customFields: "field-definition",
  customFronts: "custom-front",
  members: "member",
  groups: "group",
  frontHistory: "fronting-session",
  comments: "fronting-comment",
  notes: "journal-entry",
  polls: "poll",
  channelCategories: "channel-category",
  channels: "channel",
  chatMessages: "chat-message",
  boardMessages: "board-message",
};

/** Read and parse a manifest JSON written by the seeding script. */
export async function loadManifest(mode: "minimal" | "adversarial"): Promise<Manifest> {
  const filePath = path.join(MONOREPO_ROOT, `scripts/.sp-test-${mode}-manifest.json`);
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as Manifest;
}

/** Read the SP bearer token for a test account from the environment. */
export function loadEnvToken(mode: "minimal" | "adversarial"): string {
  const key = `SP_TEST_${mode.toUpperCase()}_TOKEN`;
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable ${key}`);
  }
  return value;
}

/** Create an API-backed import source for a test account. */
export function createApiSource(mode: "minimal" | "adversarial"): ImportDataSource {
  return createApiImportSource({
    token: loadEnvToken(mode),
    baseUrl: SP_API_BASE_URL,
  });
}

/** Create a file-backed import source from a seeded export fixture. */
export async function createFileSource(mode: "minimal" | "adversarial"): Promise<ImportDataSource> {
  const filePath = path.join(MONOREPO_ROOT, `scripts/fixtures/sp-test-${mode}-export.json`);
  const contents = await readFile(filePath);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(contents));
      controller.close();
    },
  });
  return createFileImportSource({ stream });
}

/** Build a fresh checkpoint suitable for a full import run. */
export function makeInitialCheckpoint(): ImportCheckpointState {
  return emptyCheckpointState({
    firstEntityType: collectionToEntityType("users"),
    selectedCategories: {},
    avatarMode: "skip",
  });
}

/** Sum all entity counts across every manifest collection. */
export function manifestTotalEntities(manifest: Manifest): number {
  const keys = Object.keys(COLLECTION_TO_ENTITY_TYPE) as ManifestCollectionKey[];
  let total = 0;
  for (const key of keys) {
    total += manifest[key].length;
  }
  return total;
}
