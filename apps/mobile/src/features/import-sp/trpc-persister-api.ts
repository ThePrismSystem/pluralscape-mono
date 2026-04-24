/**
 * Bridge between the PersisterApi interface and a vanilla tRPC client.
 *
 * Each PersisterApi method maps to one or more tRPC procedure calls,
 * reshaping arguments where the tRPC input schema differs from the
 * PersisterApi signature (entity ID field names, nested routers,
 * batch grouping, multi-step blob uploads).
 */

import type {
  EncryptedInput,
  EncryptedUpdate,
  PersisterApi,
  VersionedEntityRef,
} from "./persister/persister.types.js";
import type { FieldType, PollKind, SystemId } from "@pluralscape/types";

// ── Minimal tRPC client shape ───────────────────────────────────────
// Structural typing avoids importing the full AppRouter type tree.

interface Query<TInput, TOutput> {
  readonly query: (input: TInput) => Promise<TOutput>;
}

interface Mutation<TInput, TOutput> {
  readonly mutate: (input: TInput) => Promise<TOutput>;
}

/**
 * The subset of the vanilla tRPC client the bridge drives. Using a
 * structural type means the mobile app can supply its real client
 * without this file importing @trpc/client or the API's AppRouter.
 */
export interface TRPCClientSubset {
  readonly system: {
    readonly get: Query<{ systemId: SystemId }, { version: number }>;
    readonly update: Mutation<
      { systemId: SystemId; encryptedData: string; version: number },
      VersionedEntityRef
    >;
  };
  readonly systemSettings: {
    readonly settings: {
      readonly get: Query<{ systemId: SystemId }, { version: number }>;
      readonly update: Mutation<
        { systemId: SystemId; encryptedData: string; version: number },
        VersionedEntityRef
      >;
    };
  };
  readonly bucket: {
    readonly create: Mutation<{ systemId: SystemId; encryptedData: string }, VersionedEntityRef>;
    readonly update: Mutation<
      { systemId: SystemId; bucketId: string; encryptedData: string; version: number },
      VersionedEntityRef
    >;
  };
  readonly field: {
    readonly definition: {
      readonly create: Mutation<
        {
          systemId: SystemId;
          encryptedData: string;
          fieldType: FieldType;
          required: boolean;
          sortOrder: number;
        },
        VersionedEntityRef
      >;
      readonly update: Mutation<
        {
          systemId: SystemId;
          fieldDefinitionId: string;
          encryptedData: string;
          version: number;
        },
        VersionedEntityRef
      >;
    };
    readonly value: {
      readonly set: Mutation<
        {
          systemId: SystemId;
          fieldDefinitionId: string;
          owner: { kind: "member"; id: string };
          encryptedData: string;
        },
        VersionedEntityRef
      >;
    };
  };
  readonly customFront: {
    readonly create: Mutation<{ systemId: SystemId; encryptedData: string }, VersionedEntityRef>;
    readonly update: Mutation<
      { systemId: SystemId; customFrontId: string; encryptedData: string; version: number },
      VersionedEntityRef
    >;
  };
  readonly member: {
    readonly create: Mutation<{ systemId: SystemId; encryptedData: string }, VersionedEntityRef>;
    readonly update: Mutation<
      { systemId: SystemId; memberId: string; encryptedData: string; version: number },
      VersionedEntityRef
    >;
  };
  readonly frontingSession: {
    readonly create: Mutation<
      {
        systemId: SystemId;
        encryptedData: string;
        startTime: number;
        memberId: string | null;
        customFrontId: string | null;
        structureEntityId: string | null;
      },
      VersionedEntityRef
    >;
    readonly update: Mutation<
      { systemId: SystemId; sessionId: string; encryptedData: string; version: number },
      VersionedEntityRef
    >;
  };
  readonly frontingComment: {
    readonly create: Mutation<
      {
        systemId: SystemId;
        sessionId: string;
        encryptedData: string;
        memberId?: string;
        customFrontId?: string;
        structureEntityId?: string;
      },
      VersionedEntityRef
    >;
    readonly update: Mutation<
      {
        systemId: SystemId;
        sessionId: string;
        commentId: string;
        encryptedData: string;
        version: number;
      },
      VersionedEntityRef
    >;
  };
  readonly note: {
    readonly create: Mutation<
      {
        systemId: SystemId;
        encryptedData: string;
        author: { readonly entityType: "member"; readonly entityId: string } | null;
      },
      VersionedEntityRef
    >;
    readonly update: Mutation<
      { systemId: SystemId; noteId: string; encryptedData: string; version: number },
      VersionedEntityRef
    >;
  };
  readonly poll: {
    readonly create: Mutation<
      {
        systemId: SystemId;
        encryptedData: string;
        kind: PollKind;
        createdByMemberId: string | undefined;
        allowMultipleVotes: boolean;
        maxVotesPerMember: number;
        allowAbstain: boolean;
        allowVeto: boolean;
        endsAt?: number;
      },
      VersionedEntityRef
    >;
    readonly update: Mutation<
      { systemId: SystemId; pollId: string; encryptedData: string; version: number },
      VersionedEntityRef
    >;
    readonly castVote: Mutation<
      { systemId: SystemId; pollId: string; encryptedData: string },
      { id: string }
    >;
  };
  readonly channel: {
    readonly create: Mutation<
      {
        systemId: SystemId;
        encryptedData: string;
        type: "category" | "channel";
        parentId: string | null;
        sortOrder: number;
      },
      VersionedEntityRef
    >;
    readonly update: Mutation<
      { systemId: SystemId; channelId: string; encryptedData: string; version: number },
      VersionedEntityRef
    >;
  };
  readonly message: {
    readonly create: Mutation<
      {
        systemId: SystemId;
        channelId: string;
        encryptedData: string;
        timestamp: number;
        replyToId: string | null;
      },
      VersionedEntityRef
    >;
    readonly update: Mutation<
      {
        systemId: SystemId;
        channelId: string;
        messageId: string;
        encryptedData: string;
        version: number;
      },
      VersionedEntityRef
    >;
  };
  readonly boardMessage: {
    readonly create: Mutation<
      { systemId: SystemId; encryptedData: string; sortOrder: number; pinned: boolean },
      VersionedEntityRef
    >;
    readonly update: Mutation<
      {
        systemId: SystemId;
        boardMessageId: string;
        encryptedData: string;
        version: number;
      },
      VersionedEntityRef
    >;
  };
  readonly group: {
    readonly create: Mutation<
      {
        systemId: SystemId;
        encryptedData: string;
        parentGroupId: string | null;
        sortOrder: number;
      },
      VersionedEntityRef
    >;
    readonly update: Mutation<
      { systemId: SystemId; groupId: string; encryptedData: string; version: number },
      VersionedEntityRef
    >;
    readonly addMember: Mutation<
      { systemId: SystemId; groupId: string; memberId: string },
      unknown
    >;
  };
  readonly blob: {
    readonly createUploadUrl: Mutation<
      {
        systemId: SystemId;
        purpose: string;
        mimeType: string;
        sizeBytes: number;
        encryptionTier: number;
      },
      { blobId: string; uploadUrl: string }
    >;
    readonly confirmUpload: Mutation<
      { systemId: SystemId; blobId: string; checksum: string },
      unknown
    >;
  };
  readonly importEntityRef: {
    readonly lookupBatch: Mutation<
      {
        systemId: SystemId;
        source: string;
        sourceEntityType: string;
        sourceEntityIds: string[];
      },
      Record<string, string>
    >;
    readonly upsertBatch: Mutation<
      {
        systemId: SystemId;
        source: string;
        entries: Array<{
          sourceEntityType: string;
          sourceEntityId: string;
          pluralscapeEntityId: string;
        }>;
      },
      { upserted: number }
    >;
  };
}

/** Encryption tier for avatar blobs (tier 1 = system-key encrypted). */
const AVATAR_ENCRYPTION_TIER = 1;

export type FetchFn = (
  url: string,
  init: { method: string; body: Uint8Array; headers: Record<string, string> },
) => Promise<{ ok: boolean; status: number }>;

/**
 * Compute a SHA-256 hex digest of the given bytes.
 */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer — TS lib types Uint8Array.buffer as
  // ArrayBufferLike (includes SharedArrayBuffer) which is incompatible
  // with SubtleCrypto's BufferSource parameter.
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  const arr = new Uint8Array(digest);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Wrap globalThis.fetch to match the narrow FetchFn signature. */
function defaultFetch(
  url: string,
  init: { method: string; body: Uint8Array; headers: Record<string, string> },
): Promise<{ ok: boolean; status: number }> {
  // Copy into a fresh ArrayBuffer — TS lib types Uint8Array.buffer as
  // ArrayBufferLike which is incompatible with fetch's BodyInit parameter.
  const copy = new ArrayBuffer(init.body.byteLength);
  new Uint8Array(copy).set(init.body);
  return globalThis
    .fetch(url, {
      method: init.method,
      body: copy,
      headers: init.headers,
    })
    .then((r) => ({ ok: r.ok, status: r.status }));
}

/**
 * Create a PersisterApi backed by vanilla tRPC client calls.
 *
 * @param client - Vanilla tRPC client (structural subset)
 * @param fetchImpl - Optional fetch override for blob S3 uploads (defaults to globalThis.fetch)
 */
export function createTRPCPersisterApi(
  client: TRPCClientSubset,
  fetchImpl?: FetchFn,
): PersisterApi {
  const doFetch: FetchFn = fetchImpl ?? defaultFetch;

  return {
    system: {
      getCurrentVersion: async (sysId: SystemId) => {
        const result = await client.system.get.query({ systemId: sysId });
        return result.version;
      },
      update: async (sysId: SystemId, payload: EncryptedUpdate) => {
        return client.system.update.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    systemSettings: {
      getCurrentVersion: async (sysId: SystemId) => {
        const result = await client.systemSettings.settings.get.query({ systemId: sysId });
        return result.version;
      },
      update: async (sysId: SystemId, payload: EncryptedUpdate) => {
        return client.systemSettings.settings.update.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    bucket: {
      create: async (sysId: SystemId, payload: EncryptedInput) => {
        return client.bucket.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.bucket.update.mutate({
          systemId: sysId,
          bucketId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    field: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & {
          readonly fieldType: FieldType;
          readonly required: boolean;
          readonly sortOrder: number;
        },
      ) => {
        return client.field.definition.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          fieldType: payload.fieldType,
          required: payload.required,
          sortOrder: payload.sortOrder,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.field.definition.update.mutate({
          systemId: sysId,
          fieldDefinitionId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
      setValue: async (
        sysId: SystemId,
        input: {
          readonly memberId: string;
          readonly fieldDefinitionId: string;
          readonly encryptedData: string;
        },
      ) => {
        return client.field.value.set.mutate({
          systemId: sysId,
          fieldDefinitionId: input.fieldDefinitionId,
          owner: { kind: "member", id: input.memberId },
          encryptedData: input.encryptedData,
        });
      },
    },

    customFront: {
      create: async (sysId: SystemId, payload: EncryptedInput) => {
        return client.customFront.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.customFront.update.mutate({
          systemId: sysId,
          customFrontId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    member: {
      create: async (sysId: SystemId, payload: EncryptedInput) => {
        return client.member.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
        });
      },
      update: async (sysId: SystemId, memberId: string, payload: EncryptedUpdate) => {
        return client.member.update.mutate({
          systemId: sysId,
          memberId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    friend: {
      recordExternalReference: (_sysId: SystemId, externalUserId: string) =>
        Promise.resolve({ placeholderId: `import_friend_${externalUserId}` }),
    },

    frontingSession: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & {
          readonly startTime: number;
          readonly memberId: string | null;
          readonly customFrontId: string | null;
          readonly structureEntityId: string | null;
        },
      ) => {
        return client.frontingSession.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          startTime: payload.startTime,
          memberId: payload.memberId,
          customFrontId: payload.customFrontId,
          structureEntityId: payload.structureEntityId,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.frontingSession.update.mutate({
          systemId: sysId,
          sessionId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    frontingComment: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & {
          readonly sessionId: string;
          readonly memberId: string | null;
          readonly customFrontId: string | null;
          readonly structureEntityId: string | null;
        },
      ) => {
        return client.frontingComment.create.mutate({
          systemId: sysId,
          sessionId: payload.sessionId,
          encryptedData: payload.encryptedData,
          ...(payload.memberId !== null ? { memberId: payload.memberId } : {}),
          ...(payload.customFrontId !== null ? { customFrontId: payload.customFrontId } : {}),
          ...(payload.structureEntityId !== null
            ? { structureEntityId: payload.structureEntityId }
            : {}),
        });
      },
      update: async (
        sysId: SystemId,
        entityId: string,
        payload: EncryptedUpdate & { readonly sessionId: string },
      ) => {
        return client.frontingComment.update.mutate({
          systemId: sysId,
          sessionId: payload.sessionId,
          commentId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    note: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & {
          readonly author: { readonly entityType: "member"; readonly entityId: string } | null;
        },
      ) => {
        return client.note.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          author: payload.author,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.note.update.mutate({
          systemId: sysId,
          noteId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    poll: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & {
          readonly kind: PollKind;
          readonly allowMultipleVotes: boolean;
          readonly maxVotesPerMember: number;
          readonly allowAbstain: boolean;
          readonly allowVeto: boolean;
        },
      ) => {
        return client.poll.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          kind: payload.kind,
          createdByMemberId: undefined,
          allowMultipleVotes: payload.allowMultipleVotes,
          maxVotesPerMember: payload.maxVotesPerMember,
          allowAbstain: payload.allowAbstain,
          allowVeto: payload.allowVeto,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.poll.update.mutate({
          systemId: sysId,
          pollId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
      castVote: async (
        sysId: SystemId,
        input: {
          readonly pollId: string;
          readonly memberId: string | null;
          readonly encryptedData: string;
        },
      ) => {
        return client.poll.castVote.mutate({
          systemId: sysId,
          pollId: input.pollId,
          encryptedData: input.encryptedData,
        });
      },
    },

    channel: {
      create: async (
        sysId: SystemId,
        input: EncryptedInput & {
          readonly type: "category" | "channel";
          readonly parentId: string | null;
          readonly sortOrder: number;
        },
      ) => {
        return client.channel.create.mutate({
          systemId: sysId,
          encryptedData: input.encryptedData,
          type: input.type,
          parentId: input.parentId,
          sortOrder: input.sortOrder,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.channel.update.mutate({
          systemId: sysId,
          channelId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    message: {
      create: async (
        sysId: SystemId,
        input: EncryptedInput & {
          readonly channelId: string;
          readonly timestamp: number;
          readonly replyToId: string | null;
        },
      ) => {
        return client.message.create.mutate({
          systemId: sysId,
          channelId: input.channelId,
          encryptedData: input.encryptedData,
          timestamp: input.timestamp,
          replyToId: input.replyToId,
        });
      },
      update: async (
        sysId: SystemId,
        entityId: string,
        payload: EncryptedUpdate & { readonly channelId: string },
      ) => {
        return client.message.update.mutate({
          systemId: sysId,
          channelId: payload.channelId,
          messageId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    boardMessage: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & { readonly sortOrder: number; readonly pinned: boolean },
      ) => {
        return client.boardMessage.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          sortOrder: payload.sortOrder,
          pinned: payload.pinned,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.boardMessage.update.mutate({
          systemId: sysId,
          boardMessageId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    group: {
      create: async (
        sysId: SystemId,
        input: EncryptedInput & {
          readonly memberIds: readonly string[];
          readonly parentGroupId: string | null;
          readonly sortOrder: number;
        },
      ) => {
        const result = await client.group.create.mutate({
          systemId: sysId,
          encryptedData: input.encryptedData,
          parentGroupId: input.parentGroupId,
          sortOrder: input.sortOrder,
        });

        const failedMembers: string[] = [];
        for (const memberId of input.memberIds) {
          try {
            await client.group.addMember.mutate({
              systemId: sysId,
              groupId: result.id,
              memberId,
            });
          } catch {
            failedMembers.push(memberId);
          }
        }
        if (failedMembers.length > 0) {
          throw new Error(
            `group ${result.id} created but ${String(failedMembers.length)}/${String(input.memberIds.length)} addMember calls failed`,
          );
        }

        return result;
      },
      update: async (
        sysId: SystemId,
        groupId: string,
        payload: EncryptedUpdate & { readonly memberIds?: readonly string[] },
      ) => {
        return client.group.update.mutate({
          systemId: sysId,
          groupId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    blob: {
      uploadAvatar: async (
        sysId: SystemId,
        input: { readonly bytes: Uint8Array; readonly contentType: string },
      ) => {
        const { blobId, uploadUrl } = await client.blob.createUploadUrl.mutate({
          systemId: sysId,
          purpose: "avatar",
          mimeType: input.contentType,
          sizeBytes: input.bytes.length,
          encryptionTier: AVATAR_ENCRYPTION_TIER,
        });

        const response = await doFetch(uploadUrl, {
          method: "PUT",
          body: input.bytes,
          headers: { "Content-Type": input.contentType },
        });
        if (!response.ok) {
          throw new Error(`S3 upload failed with status ${String(response.status)}`);
        }

        const checksum = await sha256Hex(input.bytes);

        await client.blob.confirmUpload.mutate({
          systemId: sysId,
          blobId,
          checksum,
        });

        return { blobId };
      },
    },

    importEntityRef: {
      lookupBatch: async (sysId, input) => {
        if (input.refs.length === 0) {
          return {};
        }

        const grouped = new Map<string, string[]>();
        for (const ref of input.refs) {
          const existing = grouped.get(ref.sourceEntityType);
          if (existing) {
            existing.push(ref.sourceEntityId);
          } else {
            grouped.set(ref.sourceEntityType, [ref.sourceEntityId]);
          }
        }

        const merged: Record<string, string> = {};
        for (const [sourceEntityType, sourceEntityIds] of grouped) {
          const result = await client.importEntityRef.lookupBatch.mutate({
            systemId: sysId,
            source: input.source,
            sourceEntityType,
            sourceEntityIds,
          });
          Object.assign(merged, result);
        }

        return merged;
      },

      upsertBatch: async (sysId, input) => {
        if (input.refs.length === 0) {
          return { upserted: 0 };
        }

        return client.importEntityRef.upsertBatch.mutate({
          systemId: sysId,
          source: input.source,
          entries: input.refs.map((ref) => ({
            sourceEntityType: ref.sourceEntityType,
            sourceEntityId: ref.sourceEntityId,
            pluralscapeEntityId: ref.pluralscapeEntityId,
          })),
        });
      },
    },
  };
}
