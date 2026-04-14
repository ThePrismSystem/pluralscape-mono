/**
 * E2E test helpers for import-pk.
 *
 * Provides account registration, tRPC client creation, manifest loading,
 * source factories, and a persister wired to the real Pluralscape API
 * server on port 10099. The persister encrypts all payloads with a test
 * master key and persists through tRPC, matching the same data path the
 * mobile app takes in production.
 *
 * Generic helpers are imported from @pluralscape/test-utils/e2e.
 * This file contains only PK-specific entity dispatch and source wiring.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  encryptTier1,
  generateMasterKey,
  initSodium,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { emptyCheckpointState } from "@pluralscape/import-core";
import {
  API_BASE_URL,
  createBaseE2EPersister,
  getSystemId,
  registerTestAccount,
} from "@pluralscape/test-utils/e2e";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { z } from "zod/v4";

import { pkCollectionToEntityType } from "../../engine/entity-type-map.js";
import { createPkApiImportSource } from "../../sources/pk-api-source.js";
import { createPkFileImportSource } from "../../sources/pk-file-source.js";

import type { PkManifest } from "../integration/manifest.types.js";
import type { AppRouter } from "@pluralscape/api/trpc";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { ImportDataSource } from "@pluralscape/import-core";
import type {
  CryptoDeps,
  E2EPersisterContext,
  GenericPersistableEntity,
  HandleCreateContext,
} from "@pluralscape/test-utils/e2e";
import type { ImportCheckpointState, SystemId, T1EncryptedBlob } from "@pluralscape/types";

// ── Re-exports for test convenience ─────────────────────────────────

export { getSystemId, registerTestAccount };
export type { E2EPersisterContext };

// ── Path constants ──────────────────────────────────────────────────

const MONOREPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");

// ── tRPC client factory ─────────────────────────────────────────────

const TRPC_URL = `${API_BASE_URL}/v1/trpc`;
const MAX_URL_LENGTH = 2_083;
const MAX_BATCH_ITEMS = 10;

export type TRPCClient = ReturnType<typeof createTRPCClient<AppRouter>>;

export function makeTrpcClient(token: string): TRPCClient {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        maxURLLength: MAX_URL_LENGTH,
        maxItems: MAX_BATCH_ITEMS,
        headers: () => ({ Authorization: `Bearer ${token}` }),
      }),
    ],
  });
}

// ── Crypto helpers ──────────────────────────────────────────────────

function encryptForApi(data: unknown, masterKey: KdfMasterKey): string {
  const blob: T1EncryptedBlob = encryptTier1(data, masterKey);
  const binary = serializeEncryptedBlob(blob);
  return Buffer.from(binary).toString("base64");
}

const cryptoDeps: CryptoDeps<KdfMasterKey> = {
  ensureCryptoReady: initSodium,
  generateMasterKey,
  encryptForApi,
};

// ── E2E type aliases ────────────────────────────────────────────────

export type E2EPersisterCtx = E2EPersisterContext<KdfMasterKey>;

// ── Entity dispatch (PK-specific) ───────────────────────────────────

type PkEntityType = "member" | "group" | "fronting-session" | "privacy-bucket";

const PK_ENTITY_TYPES = new Set<string>(["member", "group", "fronting-session", "privacy-bucket"]);

function assertPayloadShape<T extends Record<string, unknown>>(
  payload: unknown,
  entityType: string,
  requiredKeys: readonly (keyof T)[],
): asserts payload is T {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Expected object payload for ${entityType}, got ${typeof payload}`);
  }
  for (const key of requiredKeys) {
    if (!((key as string) in (payload as Record<string, unknown>))) {
      throw new Error(`Missing required key "${String(key)}" in ${entityType} payload`);
    }
  }
}

async function handleCreate(
  entity: GenericPersistableEntity,
  ctx: HandleCreateContext<TRPCClient, KdfMasterKey>,
): Promise<{ id: string }> {
  const { trpc, systemId, masterKey } = ctx;

  if (!PK_ENTITY_TYPES.has(entity.entityType)) {
    throw new Error(`Unsupported PK entity type: ${entity.entityType}`);
  }
  const entityType = entity.entityType as PkEntityType;

  switch (entityType) {
    case "member": {
      assertPayloadShape<{ encrypted: unknown }>(entity.payload, "member", ["encrypted"]);
      return trpc.member.create.mutate({
        systemId,
        encryptedData: encryptForApi(entity.payload.encrypted, masterKey),
      });
    }
    case "group": {
      assertPayloadShape<{
        encrypted: unknown;
        parentGroupId: string | null;
        sortOrder: number;
        memberIds: readonly string[];
      }>(entity.payload, "group", ["encrypted", "parentGroupId", "sortOrder", "memberIds"]);
      const result = await trpc.group.create.mutate({
        systemId,
        encryptedData: encryptForApi(entity.payload.encrypted, masterKey),
        parentGroupId: entity.payload.parentGroupId,
        sortOrder: entity.payload.sortOrder,
      });
      for (const memberId of entity.payload.memberIds) {
        await trpc.group.addMember.mutate({
          systemId,
          groupId: result.id,
          memberId,
        });
      }
      return result;
    }
    case "fronting-session": {
      assertPayloadShape<{
        encrypted: unknown;
        startTime: number;
        endTime: number | null;
        memberId: string | undefined;
        customFrontId: string | undefined;
        structureEntityId: string | undefined;
      }>(entity.payload, "fronting-session", ["encrypted", "startTime"]);
      return trpc.frontingSession.create.mutate({
        systemId,
        encryptedData: encryptForApi(entity.payload.encrypted, masterKey),
        startTime: entity.payload.startTime,
        endTime: entity.payload.endTime ?? undefined,
        memberId: entity.payload.memberId,
        customFrontId: entity.payload.customFrontId,
        structureEntityId: entity.payload.structureEntityId,
      });
    }
    case "privacy-bucket": {
      assertPayloadShape<{ encrypted: unknown }>(entity.payload, "privacy-bucket", ["encrypted"]);
      return trpc.bucket.create.mutate({
        systemId,
        encryptedData: encryptForApi(entity.payload.encrypted, masterKey),
      });
    }
    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unsupported PK entity type: ${String(_exhaustive)}`);
    }
  }
}

// ── E2E persister factory ───────────────────────────────────────────

export async function createPkE2EPersister(
  trpcClient: TRPCClient,
  systemId: SystemId,
): Promise<E2EPersisterContext<KdfMasterKey>> {
  return createBaseE2EPersister({
    trpcClient,
    systemId,
    source: "pluralkit",
    crypto: cryptoDeps,
    handleCreate,
  });
}

// ── Manifest loading ────────────────────────────────────────────────

const PkManifestSchema = z.object({
  token: z.string(),
  systemId: z.string(),
  mode: z.enum(["minimal", "adversarial"]),
  expectedSessionCount: z.number().int().nonnegative(),
  members: z.array(
    z.object({
      ref: z.string(),
      sourceId: z.string(),
      fields: z.object({ name: z.string() }),
    }),
  ),
  groups: z.array(
    z.object({
      ref: z.string(),
      sourceId: z.string(),
      fields: z.object({ name: z.string() }),
    }),
  ),
  switches: z.array(
    z.object({
      ref: z.string(),
      sourceId: z.string(),
      fields: z.object({ timestamp: z.string() }),
    }),
  ),
});

export function loadManifest(mode: "minimal" | "adversarial"): PkManifest {
  const filePath = path.join(MONOREPO_ROOT, `scripts/.pk-seed-${mode}-manifest.json`);
  const raw = readFileSync(filePath, "utf-8");
  return PkManifestSchema.parse(JSON.parse(raw));
}

// ── Source factories ────────────────────────────────────────────────

export function createFileSource(mode: "minimal" | "adversarial"): ImportDataSource {
  const filePath = path.join(MONOREPO_ROOT, `scripts/.pk-test-${mode}-export.json`);
  return createPkFileImportSource({ filePath });
}

export function createApiSource(
  _mode: "minimal" | "adversarial",
  manifest: PkManifest,
): ImportDataSource {
  return createPkApiImportSource({ token: manifest.token });
}

// ── Checkpoint factory ──────────────────────────────────────────────

export function makeInitialCheckpoint(): ImportCheckpointState {
  return emptyCheckpointState({
    firstEntityType: pkCollectionToEntityType("member"),
    selectedCategories: {},
    avatarMode: "skip",
  });
}

// ── Fixture file detection ──────────────────────────────────────────

export function hasExportFixtures(): boolean {
  return (
    existsSync(path.join(MONOREPO_ROOT, "scripts/.pk-test-minimal-export.json")) &&
    existsSync(path.join(MONOREPO_ROOT, "scripts/.pk-test-adversarial-export.json"))
  );
}

export function hasManifests(): boolean {
  return (
    existsSync(path.join(MONOREPO_ROOT, "scripts/.pk-seed-minimal-manifest.json")) &&
    existsSync(path.join(MONOREPO_ROOT, "scripts/.pk-seed-adversarial-manifest.json"))
  );
}

export function hasLiveApiEnabled(): boolean {
  return (
    process.env["PK_TEST_LIVE_API"] === "true" &&
    typeof process.env["PK_TOKEN_MINIMAL"] === "string" &&
    process.env["PK_TOKEN_MINIMAL"].length > 0 &&
    typeof process.env["PK_TOKEN_ADVERSARIAL"] === "string" &&
    process.env["PK_TOKEN_ADVERSARIAL"].length > 0
  );
}
