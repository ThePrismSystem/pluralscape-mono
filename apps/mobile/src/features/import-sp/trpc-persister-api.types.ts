/**
 * Structural shape the TRPC PersisterApi bridge consumes. Captured here as a
 * subset rather than imported from the full AppRouter type tree so this
 * mobile module doesn't pull `@trpc/client` or the API's router into its
 * dependency graph.
 */
import type { VersionedEntityRef } from "./persister/persister.types.js";
import type { FieldType, PollKind, SystemId } from "@pluralscape/types";

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

export type FetchFn = (
  url: string,
  init: { method: string; body: Uint8Array; headers: Record<string, string> },
) => Promise<{ ok: boolean; status: number }>;
