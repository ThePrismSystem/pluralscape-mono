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
    case "member":
      return trpc.member.create.mutate({
        systemId,
        encryptedData: encryptForApi(
          (entity.payload as { encrypted: unknown }).encrypted,
          masterKey,
        ),
      });
    case "group": {
      const payload = entity.payload as {
        encrypted: unknown;
        parentGroupId: string | null;
        sortOrder: number;
        memberIds: readonly string[];
      };
      const result = await trpc.group.create.mutate({
        systemId,
        encryptedData: encryptForApi(payload.encrypted, masterKey),
        parentGroupId: payload.parentGroupId,
        sortOrder: payload.sortOrder,
      });
      for (const memberId of payload.memberIds) {
        await trpc.group.addMember.mutate({
          systemId,
          groupId: result.id,
          memberId,
        });
      }
      return result;
    }
    case "fronting-session": {
      const payload = entity.payload as {
        encrypted: unknown;
        startTime: number;
        endTime: number | null;
        memberId: string | undefined;
        customFrontId: string | undefined;
        structureEntityId: string | undefined;
      };
      return trpc.frontingSession.create.mutate({
        systemId,
        encryptedData: encryptForApi(payload.encrypted, masterKey),
        startTime: payload.startTime,
        endTime: payload.endTime ?? undefined,
        memberId: payload.memberId,
        customFrontId: payload.customFrontId,
        structureEntityId: payload.structureEntityId,
      });
    }
    case "privacy-bucket":
      return trpc.bucket.create.mutate({
        systemId,
        encryptedData: encryptForApi(
          (entity.payload as { encrypted: unknown }).encrypted,
          masterKey,
        ),
      });
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

export function loadManifest(mode: "minimal" | "adversarial"): PkManifest {
  const filePath = path.join(MONOREPO_ROOT, `scripts/.pk-seed-${mode}-manifest.json`);
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as PkManifest;
  for (const key of ["members", "groups", "switches"] as const) {
    for (const entry of parsed[key]) {
      if (typeof entry.ref !== "string") {
        throw new Error(
          `manifest format out of date (missing 'ref' field in ${key}) — ` +
            `delete scripts/.pk-seed-${mode}-manifest.json and re-run ` +
            `pnpm seed:pk-test ${mode} to regenerate`,
        );
      }
    }
  }
  return parsed;
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
