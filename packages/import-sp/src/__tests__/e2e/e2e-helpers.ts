/**
 * E2E test helpers for import-sp.
 *
 * Provides account registration, tRPC client creation, and a persister
 * wired to the real Pluralscape API server on port 10099. The persister
 * encrypts all payloads with a test master key and persists through tRPC,
 * matching the same data path the mobile app takes in production.
 *
 * Generic helpers are imported from @pluralscape/test-utils/e2e.
 * This file contains only SP-specific entity dispatch.
 */
import {
  encryptTier1,
  generateMasterKey,
  initSodium,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import {
  API_BASE_URL,
  createBaseE2EPersister,
  getSystemId,
  registerTestAccount,
} from "@pluralscape/test-utils/e2e";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

import type { PersistableEntity } from "../../persistence/persister.types.js";
import type { AppRouter } from "@pluralscape/api/trpc";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  CryptoDeps,
  E2EPersisterContext,
  GenericPersistableEntity,
  HandleCreateContext,
  PersisterUpsertResult,
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

export { ensureCryptoReady, generateMasterKey, getSystemId, registerTestAccount };
export type { KdfMasterKey, SystemId };

/** E2E persister context parameterized with the real master key type. */
export type E2EPersisterCtx = E2EPersisterContext<KdfMasterKey>;

/** Placeholder for update calls that route through a parent scope. */
const COMMENT_UPDATE_PLACEHOLDER_SESSION = "fs_import_placeholder";
const MESSAGE_UPDATE_PLACEHOLDER_CHANNEL = "ch_import_placeholder";

// ── SP-specific entity dispatch ─────────────────────────────────────

/**
 * Dispatch a create call to the correct tRPC procedure based on entity
 * type. Each branch matches the corresponding mobile persister helper.
 */
async function handleCreate(
  entity: GenericPersistableEntity,
  ctx: HandleCreateContext<TRPCClient, KdfMasterKey>,
): Promise<{ id: string }> {
  const spEntity = entity as PersistableEntity;
  const { trpc, systemId, masterKey } = ctx;

  switch (spEntity.entityType) {
    case "system-profile": {
      const current = await trpc.system.get.query({ systemId });
      return trpc.system.update.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload, masterKey),
        version: current.version,
      });
    }
    case "system-settings": {
      const current = await trpc.systemSettings.settings.get.query({ systemId });
      return trpc.systemSettings.settings.update.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload, masterKey),
        version: current.version,
      });
    }
    case "privacy-bucket":
      return trpc.bucket.create.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
      });
    case "field-definition":
      return trpc.field.definition.create.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        fieldType: spEntity.payload.fieldType,
        required: spEntity.payload.required,
        sortOrder: spEntity.payload.sortOrder,
      });
    case "custom-front":
      return trpc.customFront.create.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
      });
    case "member": {
      const encrypted = encryptForApi(spEntity.payload.encrypted, masterKey);
      const result = await trpc.member.create.mutate({
        systemId,
        encryptedData: encrypted,
      });
      // Fan out field values
      for (const fv of spEntity.payload.fieldValues) {
        const fieldDefId = lookupRefResult(fv.fieldSourceId);
        if (fieldDefId !== null) {
          await trpc.field.value.set.mutate({
            systemId,
            fieldDefinitionId: fieldDefId,
            owner: { kind: "member", id: result.id },
            encryptedData: encryptForApi({ value: fv.value }, masterKey),
          });
        }
      }
      return result;
    }
    case "group": {
      const result = await trpc.group.create.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        parentGroupId: spEntity.payload.parentGroupId,
        sortOrder: spEntity.payload.sortOrder,
      });
      for (const memberId of spEntity.payload.memberIds) {
        await trpc.group.addMember.mutate({
          systemId,
          groupId: result.id,
          memberId,
        });
      }
      return result;
    }
    case "fronting-session":
      return trpc.frontingSession.create.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        startTime: spEntity.payload.startTime,
        memberId: spEntity.payload.memberId,
        customFrontId: spEntity.payload.customFrontId,
        structureEntityId: spEntity.payload.structureEntityId,
      });
    case "fronting-comment":
      return trpc.frontingComment.create.mutate({
        systemId,
        sessionId: spEntity.payload.frontingSessionId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        memberId: spEntity.payload.memberId,
        customFrontId: spEntity.payload.customFrontId,
        structureEntityId: spEntity.payload.structureEntityId,
      });
    case "journal-entry":
      return trpc.note.create.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        author: spEntity.payload.author,
      });
    case "poll": {
      const result = await trpc.poll.create.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        kind: spEntity.payload.kind,
        createdByMemberId: spEntity.payload.createdByMemberId,
        allowMultipleVotes: spEntity.payload.allowMultipleVotes,
        maxVotesPerMember: spEntity.payload.maxVotesPerMember,
        allowAbstain: spEntity.payload.allowAbstain,
        allowVeto: spEntity.payload.allowVeto,
        endsAt: spEntity.payload.endsAt,
      });
      // Cast votes
      for (const vote of spEntity.payload.votes) {
        await trpc.poll.castVote.mutate({
          systemId,
          pollId: result.id,
          optionId: vote.optionId.length > 0 ? vote.optionId : null,
          voter: {
            entityType: "member" as const,
            entityId: vote.memberId ?? result.id,
          },
          encryptedData: encryptForApi({ comment: vote.comment }, masterKey),
        });
      }
      return result;
    }
    case "channel-category":
      return trpc.channel.create.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        type: spEntity.payload.type,
        parentId: spEntity.payload.parentId,
        sortOrder: spEntity.payload.sortOrder,
      });
    case "channel":
      return trpc.channel.create.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        type: spEntity.payload.type,
        parentId: spEntity.payload.parentId,
        sortOrder: spEntity.payload.sortOrder,
      });
    case "chat-message":
      return trpc.message.create.mutate({
        systemId,
        channelId: spEntity.payload.channelId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        timestamp: spEntity.payload.timestamp,
        replyToId: spEntity.payload.replyToId,
      });
    case "board-message":
      return trpc.boardMessage.create.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        sortOrder: spEntity.payload.sortOrder,
        pinned: spEntity.payload.pinned,
      });
    default: {
      const _exhaustive: never = spEntity;
      throw new Error(`Unhandled entity type: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Look up a previously imported entity's Pluralscape ID by source ID.
 * Used for field-value fan-out. Returns null if not found.
 */
const refResults = new Map<string, string>();
function lookupRefResult(sourceId: string): string | null {
  return refResults.get(`field-definition:${sourceId}`) ?? null;
}

/**
 * Handle an update call by dispatching to the correct tRPC procedure.
 */
async function handleUpdate(
  entity: GenericPersistableEntity,
  existingId: string,
  ctx: HandleCreateContext<TRPCClient, KdfMasterKey>,
): Promise<PersisterUpsertResult> {
  const spEntity = entity as PersistableEntity;
  const { trpc, systemId, masterKey } = ctx;
  const version = 1;

  switch (spEntity.entityType) {
    case "system-profile":
      await trpc.system.update.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload, masterKey),
        version,
      });
      break;
    case "system-settings":
      await trpc.systemSettings.settings.update.mutate({
        systemId,
        encryptedData: encryptForApi(spEntity.payload, masterKey),
        version,
      });
      break;
    case "privacy-bucket":
      await trpc.bucket.update.mutate({
        systemId,
        bucketId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "field-definition":
      await trpc.field.definition.update.mutate({
        systemId,
        fieldDefinitionId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "custom-front":
      await trpc.customFront.update.mutate({
        systemId,
        customFrontId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "member":
      await trpc.member.update.mutate({
        systemId,
        memberId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "group":
      await trpc.group.update.mutate({
        systemId,
        groupId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "fronting-session":
      await trpc.frontingSession.update.mutate({
        systemId,
        sessionId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "fronting-comment":
      await trpc.frontingComment.update.mutate({
        systemId,
        sessionId: COMMENT_UPDATE_PLACEHOLDER_SESSION,
        commentId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "journal-entry":
      await trpc.note.update.mutate({
        systemId,
        noteId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "poll":
      await trpc.poll.update.mutate({
        systemId,
        pollId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "channel-category":
      await trpc.channel.update.mutate({
        systemId,
        channelId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "channel":
      await trpc.channel.update.mutate({
        systemId,
        channelId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "chat-message":
      await trpc.message.update.mutate({
        systemId,
        channelId: MESSAGE_UPDATE_PLACEHOLDER_CHANNEL,
        messageId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    case "board-message":
      await trpc.boardMessage.update.mutate({
        systemId,
        boardMessageId: existingId,
        encryptedData: encryptForApi(spEntity.payload.encrypted, masterKey),
        version,
      });
      break;
    default: {
      const _exhaustive: never = spEntity;
      throw new Error(`Unhandled entity type: ${String(_exhaustive)}`);
    }
  }
  return { action: "updated", pluralscapeEntityId: existingId };
}

// ── E2E Persister (SP-specific) ────────────────────────────────────

/**
 * Create an E2E persister for SP import backed by real tRPC calls.
 */
export async function createE2EPersister(
  trpcClient: TRPCClient,
  systemId: SystemId,
): Promise<E2EPersisterContext<KdfMasterKey>> {
  const ctx = await createBaseE2EPersister({
    trpcClient,
    systemId,
    source: "simply-plural",
    crypto: cryptoDeps,
    handleCreate,
    handleUpdate,
  });

  // Wire up ref tracking for field-value fan-out -- the base persister
  // tracks entity IDs internally but SP needs a local map for inline
  // field-definition lookups during member create.
  const originalUpsert = ctx.persister.upsertEntity.bind(ctx.persister);
  ctx.persister.upsertEntity = async (entity) => {
    const result = await originalUpsert(entity);
    if (result.action === "created") {
      refResults.set(`${entity.entityType}:${entity.sourceEntityId}`, result.pluralscapeEntityId);
    }
    return result;
  };

  return ctx;
}
