/**
 * E2E test helpers for import-pk.
 *
 * For file-source tests (in-memory persister), provides fixture file
 * resolution and a convenience wrapper that runs the full PK import
 * pipeline. For server-backed tests, provides a PK-specific E2E persister
 * that encrypts payloads and persists through tRPC.
 */
import path from "node:path";

import {
  encryptTier1,
  generateMasterKey,
  initSodium,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { createInMemoryPersister } from "@pluralscape/import-core/testing";
import {
  API_BASE_URL,
  createBaseE2EPersister,
  getSystemId,
  registerTestAccount,
} from "@pluralscape/test-utils/e2e";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

import { runPkImport } from "../../run-pk-import.js";
import { createPkFileImportSource } from "../../sources/pk-file-source.js";

import type { AppRouter } from "@pluralscape/api/trpc";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { ImportRunResult } from "@pluralscape/import-core";
import type { InMemoryPersisterSnapshot } from "@pluralscape/import-core/testing";
import type {
  CryptoDeps,
  E2EPersisterContext,
  GenericPersistableEntity,
  HandleCreateContext,
} from "@pluralscape/test-utils/e2e";
import type { SystemId, T1EncryptedBlob } from "@pluralscape/types";

// ── tRPC client factory (local to avoid circular dep) ─────────────────

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

// ── Crypto helpers (local to avoid circular dep) ──────────────────────

let cryptoReady = false;

async function ensureCryptoReady(): Promise<void> {
  if (cryptoReady) return;
  await initSodium();
  cryptoReady = true;
}

function encryptForApi(data: unknown, masterKey: KdfMasterKey): string {
  const blob: T1EncryptedBlob = encryptTier1(data, masterKey);
  const binary = serializeEncryptedBlob(blob);
  return Buffer.from(binary).toString("base64");
}

const cryptoDeps: CryptoDeps<KdfMasterKey> = {
  ensureCryptoReady,
  generateMasterKey,
  encryptForApi,
};

export { getSystemId, registerTestAccount };

/** E2E persister context parameterized with the real master key type. */
export type E2EPersisterCtx = E2EPersisterContext<KdfMasterKey>;

/** Resolved path to the fixtures directory. */
export const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");

/** Build an absolute path to a fixture file. */
export function fixturePath(filename: string): string {
  return path.join(FIXTURES_DIR, filename);
}

/** No-op progress callback for tests that do not need progress tracking. */
function noopProgress(): Promise<void> {
  return Promise.resolve();
}

/** Result returned by {@link runFileImport}. */
export interface FileImportResult {
  readonly result: ImportRunResult;
  readonly snapshot: InMemoryPersisterSnapshot;
}

/**
 * Run a full PK import from a JSON export file using an in-memory persister.
 *
 * Creates the file source and in-memory persister, runs the engine, and
 * returns both the run result and a snapshot of persisted entities.
 */
export async function runFileImport(filePath: string): Promise<FileImportResult> {
  const source = createPkFileImportSource({ filePath });
  const { persister, snapshot } = createInMemoryPersister();

  const result = await runPkImport({
    source,
    persister,
    options: { selectedCategories: {}, avatarMode: "skip" },
    onProgress: noopProgress,
  });

  return { result, snapshot: snapshot() };
}

// ── Server-backed E2E Persister (PK-specific) ──────────────────────

/** Entity types the PK import engine produces. */
type PkEntityType = "member" | "group" | "fronting-session" | "privacy-bucket";

const PK_ENTITY_TYPES = new Set<string>(["member", "group", "fronting-session", "privacy-bucket"]);

/**
 * Dispatch a PK entity create to the correct tRPC procedure.
 *
 * PK supports 4 entity types: member, group, fronting-session, privacy-bucket.
 */
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

/**
 * Create an E2E persister for PK import backed by real tRPC calls.
 */
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

/**
 * Result of a server-backed import run.
 */
export interface ServerImportResult {
  readonly result: ImportRunResult;
  readonly ctx: E2EPersisterContext<KdfMasterKey>;
}

/**
 * Run a full PK import from a JSON export file using a server-backed persister.
 */
export async function runServerFileImport(
  filePath: string,
  trpcClient: TRPCClient,
  systemId: SystemId,
): Promise<ServerImportResult> {
  const source = createPkFileImportSource({ filePath });
  const ctx = await createPkE2EPersister(trpcClient, systemId);

  const result = await runPkImport({
    source,
    persister: ctx.persister,
    options: { selectedCategories: {}, avatarMode: "skip" },
    onProgress: noopProgress,
  });

  return { result, ctx };
}
