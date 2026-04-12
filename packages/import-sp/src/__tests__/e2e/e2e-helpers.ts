/**
 * E2E test helpers for import-sp.
 *
 * Provides account registration, tRPC client creation, and a persister
 * wired to the real Pluralscape API server on port 10099. The persister
 * encrypts all payloads with a test master key and persists through tRPC,
 * matching the same data path the mobile app takes in production.
 */
import crypto from "node:crypto";

import {
  encryptTier1,
  generateMasterKey,
  initSodium,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

import type {
  PersistableEntity,
  Persister,
  PersisterUpsertResult,
} from "../../persistence/persister.types.js";
import type { AppRouter } from "@pluralscape/api/trpc";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  ImportCollectionType,
  ImportError,
  SystemId,
  T1EncryptedBlob,
} from "@pluralscape/types";

const E2E_PORT = 10_099;
const API_BASE_URL = `http://localhost:${String(E2E_PORT)}`;
const TRPC_URL = `${API_BASE_URL}/v1/trpc`;

/** Maximum URL length before httpBatchLink splits into multiple requests. */
const MAX_URL_LENGTH = 2_083;

/** Maximum operations per batch request. */
const MAX_BATCH_ITEMS = 10;

/** Batch size for ref upserts (matches mobile persister). */
const REF_BATCH_SIZE = 50;

/** Default sort order for imported entities. */
const DEFAULT_SORT_ORDER = 0;

/** Default max votes per member for imported polls. */
const SINGLE_VOTE_MAX = 1;

/** Placeholder for update calls that route through a parent scope. */
const COMMENT_UPDATE_PLACEHOLDER_SESSION = "fs_import_placeholder";
const MESSAGE_UPDATE_PLACEHOLDER_CHANNEL = "ch_import_placeholder";

// ── Registration ──────────────────────────────────────────��─────────

interface RegisterData {
  sessionToken: string;
  recoveryKey: string;
  accountId: string;
  accountType: string;
}

interface RegisterResponse {
  data: RegisterData;
}

export interface RegisteredAccount {
  sessionToken: string;
  recoveryKey: string;
  accountId: string;
  email: string;
  password: string;
}

/**
 * Register a fresh test account against the E2E API server.
 */
export async function registerTestAccount(): Promise<RegisteredAccount> {
  const uuid = crypto.randomUUID();
  const email = `e2e-import-${uuid}@test.pluralscape.local`;
  const password = `E2E-ImportTest-${uuid}`;

  const res = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      recoveryKeyBackupConfirmed: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Registration failed (${String(res.status)}): ${body}`);
  }

  const envelope = (await res.json()) as RegisterResponse;
  return {
    ...envelope.data,
    email,
    password,
  };
}

// ── System discovery ────────────────────────────────────────────────

interface SystemListItem {
  id: string;
}

interface SystemListResponse {
  data: SystemListItem[];
}

/**
 * Fetch the first system ID for the authenticated account via REST.
 */
export async function getSystemId(sessionToken: string): Promise<SystemId> {
  const res = await fetch(`${API_BASE_URL}/v1/systems`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to list systems (${String(res.status)}): ${body}`);
  }

  const body = (await res.json()) as SystemListResponse;
  const first = body.data[0];
  if (!first) {
    throw new Error("No systems found for authenticated account");
  }
  return first.id as SystemId;
}

// ── tRPC client ─────────────────────────────────────────────────────

export type TRPCClient = ReturnType<typeof createTRPCClient<AppRouter>>;

/**
 * Create a typed vanilla tRPC client for the E2E API server.
 */
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

// ── Crypto initialization ───────────────────────────────────────────

let cryptoReady = false;

export async function ensureCryptoReady(): Promise<void> {
  if (cryptoReady) return;
  await initSodium();
  cryptoReady = true;
}

/**
 * Encrypt a payload as a T1 blob and return the base64 string the API expects.
 */
function encryptForApi(data: unknown, masterKey: KdfMasterKey): string {
  const blob: T1EncryptedBlob = encryptTier1(data, masterKey);
  const binary = serializeEncryptedBlob(blob);
  return Buffer.from(binary).toString("base64");
}

// ── E2E Persister ───────────────────────────────────────────────────

/** A ref entry queued for batch upsert. */
interface QueuedRef {
  readonly sourceEntityType: ImportCollectionType;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
}

export interface E2EPersisterContext {
  readonly persister: Persister;
  readonly masterKey: KdfMasterKey;
  readonly systemId: SystemId;
  /** Count of entities created during the import run. */
  readonly getCreatedCount: () => number;
  /** Drain any non-fatal errors recorded by the persister. */
  readonly drainErrors: () => readonly ImportError[];
}

/**
 * Create a Persister backed by real tRPC calls to the E2E API server.
 *
 * Encrypts all payloads with a freshly generated master key and persists
 * them through the real API, verifying the full import pipeline from
 * engine through encryption to server persistence.
 *
 * Avatar fetching is not supported — tests should use avatarMode: "skip".
 */
export async function createE2EPersister(
  trpcClient: TRPCClient,
  systemId: SystemId,
): Promise<E2EPersisterContext> {
  await ensureCryptoReady();
  const masterKey = generateMasterKey();

  const refQueue: QueuedRef[] = [];
  const errors: ImportError[] = [];
  let createdCount = 0;

  async function flushRefs(): Promise<void> {
    while (refQueue.length >= REF_BATCH_SIZE) {
      const batch = refQueue.splice(0, REF_BATCH_SIZE);
      await trpcClient.importEntityRef.upsertBatch.mutate({
        systemId,
        source: "simply-plural",
        entries: batch.map((r) => ({
          sourceEntityType: r.sourceEntityType,
          sourceEntityId: r.sourceEntityId,
          pluralscapeEntityId: r.pluralscapeEntityId,
        })),
      });
    }
  }

  async function flushAllRefs(): Promise<void> {
    await flushRefs();
    if (refQueue.length > 0) {
      const batch = refQueue.splice(0, refQueue.length);
      await trpcClient.importEntityRef.upsertBatch.mutate({
        systemId,
        source: "simply-plural",
        entries: batch.map((r) => ({
          sourceEntityType: r.sourceEntityType,
          sourceEntityId: r.sourceEntityId,
          pluralscapeEntityId: r.pluralscapeEntityId,
        })),
      });
    }
  }

  function queueRef(entityType: ImportCollectionType, sourceEntityId: string, psId: string): void {
    refQueue.push({
      sourceEntityType: entityType,
      sourceEntityId,
      pluralscapeEntityId: psId,
    });
  }

  /**
   * Dispatch a create call to the correct tRPC procedure based on entity
   * type. Each branch matches the corresponding mobile persister helper.
   */
  async function handleCreate(entity: PersistableEntity): Promise<{ id: string }> {
    switch (entity.entityType) {
      case "system-profile": {
        const current = await trpcClient.system.get.query({ systemId });
        return trpcClient.system.update.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version: current.version,
        });
      }
      case "system-settings": {
        const current = await trpcClient.systemSettings.settings.get.query({ systemId });
        return trpcClient.systemSettings.settings.update.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version: current.version,
        });
      }
      case "privacy-bucket":
        return trpcClient.bucket.create.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
        });
      case "field-definition":
        return trpcClient.field.definition.create.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          fieldType: entity.payload.fieldType,
        });
      case "custom-front":
        return trpcClient.customFront.create.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
        });
      case "member": {
        const encrypted = encryptForApi(entity.payload.member, masterKey);
        const result = await trpcClient.member.create.mutate({
          systemId,
          encryptedData: encrypted,
        });
        // Fan out field values
        for (const fv of entity.payload.fieldValues) {
          const fieldDefId = lookupRefResult(fv.fieldSourceId);
          if (fieldDefId !== null) {
            await trpcClient.field.value.set.mutate({
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
        const groupCore = {
          name: entity.payload.name,
          description: entity.payload.description,
          color: entity.payload.color,
        };
        const result = await trpcClient.group.create.mutate({
          systemId,
          encryptedData: encryptForApi(groupCore, masterKey),
          parentGroupId: null,
          sortOrder: DEFAULT_SORT_ORDER,
        });
        for (const memberId of entity.payload.memberIds) {
          await trpcClient.group.addMember.mutate({
            systemId,
            groupId: result.id,
            memberId,
          });
        }
        return result;
      }
      case "fronting-session":
        return trpcClient.frontingSession.create.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          startTime: entity.payload.startTime,
          memberId: entity.payload.memberId ?? undefined,
          customFrontId: entity.payload.customFrontId ?? undefined,
          structureEntityId: undefined,
        });
      case "fronting-comment":
        return trpcClient.frontingComment.create.mutate({
          systemId,
          sessionId: entity.payload.frontingSessionId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          memberId: undefined,
          customFrontId: undefined,
          structureEntityId: undefined,
        });
      case "journal-entry":
        return trpcClient.note.create.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
        });
      case "poll": {
        const result = await trpcClient.poll.create.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload.poll, masterKey),
          kind: entity.payload.poll.kind,
          createdByMemberId: undefined,
          allowMultipleVotes: false,
          maxVotesPerMember: SINGLE_VOTE_MAX,
          allowAbstain: entity.payload.poll.allowAbstain,
          allowVeto: entity.payload.poll.allowVeto,
        });
        // Cast votes
        for (const vote of entity.payload.votes) {
          await trpcClient.poll.castVote.mutate({
            systemId,
            pollId: result.id,
            optionId: vote.optionId.length > 0 ? vote.optionId : null,
            voter: {
              entityType: "member" as const,
              entityId: vote.memberId ?? result.id,
            },
            encryptedData: encryptForApi(vote, masterKey),
          });
        }
        return result;
      }
      case "channel-category":
        return trpcClient.channel.create.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          type: "category",
          parentId: null,
          sortOrder: DEFAULT_SORT_ORDER,
        });
      case "channel":
        return trpcClient.channel.create.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          type: "channel",
          parentId: entity.payload.parentChannelId,
          sortOrder: entity.payload.order ?? DEFAULT_SORT_ORDER,
        });
      case "chat-message":
        return trpcClient.message.create.mutate({
          systemId,
          channelId: entity.payload.channelId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          timestamp: entity.payload.createdAt,
          replyToId: undefined,
        });
      case "board-message":
        return trpcClient.boardMessage.create.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          sortOrder: DEFAULT_SORT_ORDER,
        });
      default: {
        const _exhaustive: never = entity;
        throw new Error(`Unhandled entity type: ${String(_exhaustive)}`);
      }
    }
  }

  /**
   * Look up a previously imported entity's Pluralscape ID by its ref queue.
   * This is used for field-value fan-out where the field definition's source
   * ID needs resolving. Returns null if not found.
   */
  const refResults = new Map<string, string>();
  function lookupRefResult(sourceId: string): string | null {
    // Walk all queued + already flushed refs looking for a field-definition
    for (const ref of refQueue) {
      if (ref.sourceEntityType === "field-definition" && ref.sourceEntityId === sourceId) {
        return ref.pluralscapeEntityId;
      }
    }
    return refResults.get(`field-definition:${sourceId}`) ?? null;
  }

  async function handleUpdate(
    entity: PersistableEntity,
    existingId: string,
  ): Promise<PersisterUpsertResult> {
    const version = 1;
    switch (entity.entityType) {
      case "system-profile":
        await trpcClient.system.update.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      case "system-settings":
        await trpcClient.systemSettings.settings.update.mutate({
          systemId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      case "privacy-bucket":
        await trpcClient.bucket.update.mutate({
          systemId,
          bucketId: existingId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      case "field-definition":
        await trpcClient.field.definition.update.mutate({
          systemId,
          fieldDefinitionId: existingId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      case "custom-front":
        await trpcClient.customFront.update.mutate({
          systemId,
          customFrontId: existingId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      case "member":
        await trpcClient.member.update.mutate({
          systemId,
          memberId: existingId,
          encryptedData: encryptForApi(entity.payload.member, masterKey),
          version,
        });
        break;
      case "group":
        await trpcClient.group.update.mutate({
          systemId,
          groupId: existingId,
          encryptedData: encryptForApi(
            {
              name: entity.payload.name,
              description: entity.payload.description,
              color: entity.payload.color,
            },
            masterKey,
          ),
          version,
        });
        break;
      case "fronting-session":
        await trpcClient.frontingSession.update.mutate({
          systemId,
          sessionId: existingId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      case "fronting-comment":
        await trpcClient.frontingComment.update.mutate({
          systemId,
          sessionId: COMMENT_UPDATE_PLACEHOLDER_SESSION,
          commentId: existingId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      case "journal-entry":
        await trpcClient.note.update.mutate({
          systemId,
          noteId: existingId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      case "poll":
        await trpcClient.poll.update.mutate({
          systemId,
          pollId: existingId,
          encryptedData: encryptForApi(entity.payload.poll, masterKey),
          version,
        });
        break;
      case "channel-category":
        await trpcClient.channel.update.mutate({
          systemId,
          channelId: existingId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      case "channel":
        await trpcClient.channel.update.mutate({
          systemId,
          channelId: existingId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      case "chat-message":
        await trpcClient.message.update.mutate({
          systemId,
          channelId: MESSAGE_UPDATE_PLACEHOLDER_CHANNEL,
          messageId: existingId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      case "board-message":
        await trpcClient.boardMessage.update.mutate({
          systemId,
          boardMessageId: existingId,
          encryptedData: encryptForApi(entity.payload, masterKey),
          version,
        });
        break;
      default: {
        const _exhaustive: never = entity;
        throw new Error(`Unhandled entity type: ${String(_exhaustive)}`);
      }
    }
    return { action: "updated", pluralscapeEntityId: existingId };
  }

  // ID translation: entityType:sourceEntityId -> Pluralscape entity ID
  const idMap = new Map<string, string>();

  async function upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult> {
    const key = `${entity.entityType}:${entity.sourceEntityId}`;
    const existingId = idMap.get(key);

    if (existingId !== undefined) {
      return handleUpdate(entity, existingId);
    }

    const result = await handleCreate(entity);
    createdCount += 1;
    idMap.set(key, result.id);
    // Track ref results for field-value fan-out lookups
    refResults.set(key, result.id);
    queueRef(entity.entityType, entity.sourceEntityId, result.id);
    await flushRefs();
    return { action: "created", pluralscapeEntityId: result.id };
  }

  const persister: Persister = {
    upsertEntity,
    recordError(error: ImportError): Promise<void> {
      errors.push(error);
      return Promise.resolve();
    },
    async flush(): Promise<void> {
      await flushAllRefs();
    },
  };

  return {
    persister,
    masterKey,
    systemId,
    getCreatedCount: () => createdCount,
    drainErrors: () => errors.splice(0, errors.length),
  };
}
