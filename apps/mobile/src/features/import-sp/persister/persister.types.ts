/**
 * Persister types for the mobile-side Simply Plural import glue.
 *
 * These types describe the contract between `mobile-persister.ts` (which
 * implements the engine's `Persister` interface) and the 17 per-entity
 * helpers in this directory. Each helper is a thin adapter that:
 *
 * 1. Validates the opaque `unknown` payload the engine hands it.
 * 2. Resolves any foreign-key references through the `IdTranslationTable`.
 * 3. Encrypts the payload using the caller's master key.
 * 4. Calls the appropriate mutation through the injected `PersisterApi`.
 * 5. Returns the new (or updated) Pluralscape entity ID.
 *
 * The `PersisterApi` interface is a narrow structural shape covering only
 * the operations the persisters need — no tRPC types leak into the
 * persister surface. The real wiring (vanilla tRPC client calls) lives in
 * Phase D and supplies an implementation of this interface; tests supply
 * mock objects satisfying the same shape.
 */

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { AvatarFetcher } from "@pluralscape/import-sp/avatar-fetcher-types";
import type {
  FieldType,
  ImportError,
  ImportSourceFormat,
  PollKind,
  SystemId,
} from "@pluralscape/types";

// ── Versioned operations ─────────────────────────────────────────────

/** Shape emitted by an "encrypt for create" transform. */
export interface EncryptedInput {
  readonly encryptedData: string;
}

/** Shape emitted by an "encrypt for update" transform (adds version). */
export interface EncryptedUpdate {
  readonly encryptedData: string;
  readonly version: number;
}

/** A record with an ID and a version — used as the result of most create/update calls. */
export interface VersionedEntityRef {
  readonly id: string;
  readonly version: number;
}

// ── PersisterApi: per-entity narrow mutation surface ─────────────────

/**
 * Standalone procedure signatures. Each `PersisterProc*` is a plain
 * function type (rather than a method signature) so callers can destruct
 * them off `PersisterApi` without tripping
 * `@typescript-eslint/unbound-method`.
 */
export type PersisterProcGetVersion = (systemId: SystemId) => Promise<number>;
export type PersisterProcUpdateVersioned = (
  systemId: SystemId,
  payload: EncryptedUpdate,
) => Promise<VersionedEntityRef>;
export type PersisterProcUpdateById = (
  systemId: SystemId,
  entityId: string,
  payload: EncryptedUpdate,
) => Promise<VersionedEntityRef>;
export type PersisterProcFrontingCommentUpdate = (
  systemId: SystemId,
  entityId: string,
  payload: EncryptedUpdate & { readonly sessionId: string },
) => Promise<VersionedEntityRef>;
export type PersisterProcMessageUpdate = (
  systemId: SystemId,
  entityId: string,
  payload: EncryptedUpdate & { readonly channelId: string },
) => Promise<VersionedEntityRef>;
export type PersisterProcCreate = (
  systemId: SystemId,
  payload: EncryptedInput,
) => Promise<VersionedEntityRef>;
export type PersisterProcFieldSetValue = (
  systemId: SystemId,
  input: {
    readonly memberId: string;
    readonly fieldDefinitionId: string;
    readonly encryptedData: string;
  },
) => Promise<VersionedEntityRef>;
export type PersisterProcMemberCreate = (
  systemId: SystemId,
  payload: EncryptedInput & { readonly avatarBlobId?: string },
) => Promise<VersionedEntityRef>;
export type PersisterProcMemberUpdate = (
  systemId: SystemId,
  memberId: string,
  payload: EncryptedUpdate & { readonly avatarBlobId?: string },
) => Promise<VersionedEntityRef>;
export type PersisterProcFriendRecord = (
  systemId: SystemId,
  externalUserId: string,
  status: "accepted" | "pending",
) => Promise<{ readonly placeholderId: string }>;
export type PersisterProcPollCastVote = (
  systemId: SystemId,
  input: {
    readonly pollId: string;
    readonly memberId: string | null;
    readonly encryptedData: string;
  },
) => Promise<{ readonly id: string }>;
export type PersisterProcFieldDefinitionCreate = (
  systemId: SystemId,
  payload: EncryptedInput & { readonly fieldType: FieldType },
) => Promise<VersionedEntityRef>;
export type PersisterProcPollCreate = (
  systemId: SystemId,
  payload: EncryptedInput & {
    readonly kind: PollKind;
    readonly allowMultipleVotes: boolean;
    readonly maxVotesPerMember: number;
    readonly allowAbstain: boolean;
    readonly allowVeto: boolean;
  },
) => Promise<VersionedEntityRef>;
export type PersisterProcFrontingSessionCreate = (
  systemId: SystemId,
  payload: EncryptedInput & { readonly startTime: number },
) => Promise<VersionedEntityRef>;
export type PersisterProcFrontingCommentCreate = (
  systemId: SystemId,
  payload: EncryptedInput & {
    readonly sessionId: string;
    readonly memberId?: string;
    readonly customFrontId?: string;
  },
) => Promise<VersionedEntityRef>;
export type PersisterProcBoardMessageCreate = (
  systemId: SystemId,
  payload: EncryptedInput & { readonly sortOrder: number },
) => Promise<VersionedEntityRef>;
export type PersisterProcChannelCreate = (
  systemId: SystemId,
  input: EncryptedInput & {
    readonly type: "category" | "channel";
    readonly parentId: string | null;
    readonly sortOrder: number;
  },
) => Promise<VersionedEntityRef>;
export type PersisterProcMessageCreate = (
  systemId: SystemId,
  input: EncryptedInput & {
    readonly channelId: string;
    readonly timestamp: number;
  },
) => Promise<VersionedEntityRef>;
export type PersisterProcGroupCreate = (
  systemId: SystemId,
  input: EncryptedInput & {
    readonly memberIds: readonly string[];
    readonly parentGroupId: string | null;
    readonly sortOrder: number;
  },
) => Promise<VersionedEntityRef>;
export type PersisterProcGroupUpdate = (
  systemId: SystemId,
  groupId: string,
  payload: EncryptedUpdate & { readonly memberIds?: readonly string[] },
) => Promise<VersionedEntityRef>;
export type PersisterProcBlobUpload = (
  systemId: SystemId,
  input: { readonly bytes: Uint8Array; readonly contentType: string },
) => Promise<{ readonly blobId: string }>;
export type PersisterProcRefLookupBatch = (
  systemId: SystemId,
  input: {
    readonly source: ImportSourceFormat;
    readonly refs: readonly {
      readonly sourceEntityType: string;
      readonly sourceEntityId: string;
    }[];
  },
) => Promise<Record<string, string>>;
export type PersisterProcRefUpsertBatch = (
  systemId: SystemId,
  input: {
    readonly source: ImportSourceFormat;
    readonly refs: readonly {
      readonly sourceEntityType: string;
      readonly sourceEntityId: string;
      readonly pluralscapeEntityId: string;
    }[];
  },
) => Promise<{ readonly upserted: number }>;

/**
 * Narrow structural API the persisters drive. Each per-entity block holds
 * exactly the operations Phase C needs. Fields are plain function types so
 * the lint rule's unbound-method warning does not fire when destructuring
 * them off the api object.
 */
export interface PersisterApi {
  readonly system: {
    readonly getCurrentVersion: PersisterProcGetVersion;
    readonly update: PersisterProcUpdateVersioned;
  };
  readonly systemSettings: {
    readonly getCurrentVersion: PersisterProcGetVersion;
    readonly update: PersisterProcUpdateVersioned;
  };
  readonly bucket: {
    readonly create: PersisterProcCreate;
    readonly update: PersisterProcUpdateById;
  };
  readonly field: {
    readonly create: PersisterProcFieldDefinitionCreate;
    readonly update: PersisterProcUpdateById;
    readonly setValue: PersisterProcFieldSetValue;
  };
  readonly customFront: {
    readonly create: PersisterProcCreate;
    readonly update: PersisterProcUpdateById;
  };
  readonly member: {
    readonly create: PersisterProcMemberCreate;
    readonly update: PersisterProcMemberUpdate;
  };
  readonly friend: {
    /**
     * SP friend records reference an external user who may or may not be
     * on Pluralscape. There is no direct "create friend" mutation — the
     * persister records a source-only ref instead.
     */
    readonly recordExternalReference: PersisterProcFriendRecord;
  };
  readonly frontingSession: {
    readonly create: PersisterProcFrontingSessionCreate;
    readonly update: PersisterProcUpdateById;
  };
  readonly frontingComment: {
    readonly create: PersisterProcFrontingCommentCreate;
    readonly update: PersisterProcFrontingCommentUpdate;
  };
  readonly note: {
    readonly create: PersisterProcCreate;
    readonly update: PersisterProcUpdateById;
  };
  readonly poll: {
    readonly create: PersisterProcPollCreate;
    readonly update: PersisterProcUpdateById;
    readonly castVote: PersisterProcPollCastVote;
  };
  readonly channel: {
    readonly create: PersisterProcChannelCreate;
    readonly update: PersisterProcUpdateById;
  };
  readonly message: {
    readonly create: PersisterProcMessageCreate;
    readonly update: PersisterProcMessageUpdate;
  };
  readonly boardMessage: {
    readonly create: PersisterProcBoardMessageCreate;
    readonly update: PersisterProcUpdateById;
  };
  readonly group: {
    readonly create: PersisterProcGroupCreate;
    readonly update: PersisterProcGroupUpdate;
  };
  readonly blob: {
    readonly uploadAvatar: PersisterProcBlobUpload;
  };
  readonly importEntityRef: {
    readonly lookupBatch: PersisterProcRefLookupBatch;
    readonly upsertBatch: PersisterProcRefUpsertBatch;
  };
}

// ── IdTranslationTable ────────────────────────────────────────────────

/**
 * In-memory source-ID → Pluralscape-ID lookup used during a single import
 * run. Seeded at construction from `importEntityRef.lookupBatch` (so
 * resumes pick up existing refs) and populated further as each persister
 * returns a new ID.
 */
export interface IdTranslationTable {
  readonly get: (sourceEntityType: string, sourceEntityId: string) => string | null;
  readonly set: (
    sourceEntityType: string,
    sourceEntityId: string,
    pluralscapeEntityId: string,
  ) => void;
}

// ── Persister context ─────────────────────────────────────────────────

/** Shared state and collaborators passed to every entity persister call. */
export interface PersisterContext {
  readonly systemId: SystemId;
  readonly source: ImportSourceFormat;
  readonly masterKey: KdfMasterKey;
  readonly api: PersisterApi;
  readonly idTranslation: IdTranslationTable;
  readonly avatarFetcher: AvatarFetcher;
  /** Records a non-fatal error for later drain via the persister. */
  readonly recordError: (error: ImportError) => void;
  /**
   * Queues a ref upsert for batched flushing. Called by the dispatch
   * wiring after each successful create so the Pluralscape ID becomes
   * resumable.
   */
  readonly queueRefUpsert: (
    sourceEntityType: string,
    sourceEntityId: string,
    pluralscapeEntityId: string,
  ) => void;
}

// ── Helper results ────────────────────────────────────────────────────

/** The result of a helper `create` call — carries the new Pluralscape ID. */
export interface PersisterCreateResult {
  readonly pluralscapeEntityId: string;
}

/** The result of a helper `update` call — carries the Pluralscape ID unchanged. */
export interface PersisterUpdateResult {
  readonly pluralscapeEntityId: string;
}

// ── The helper contract ───────────────────────────────────────────────

/**
 * Contract every per-entity helper satisfies. `TPayload` is the narrowed
 * shape each helper expects after `assertPayloadShape` validates the
 * opaque engine payload.
 *
 * `create` and `update` are called exclusively by the dispatch table; the
 * helper never decides between them itself. `update` is only invoked when
 * the IdTranslationTable already holds a Pluralscape ID for this source
 * entity, so the helper can assume `existingId` is valid.
 *
 * Update-only helpers (system-profile, system-settings) leave `create` as
 * a helper that throws — the dispatch table for those entity types always
 * routes to `update` because the rows pre-exist for the account.
 */
export interface EntityPersister<TPayload = unknown> {
  readonly create: (ctx: PersisterContext, payload: TPayload) => Promise<PersisterCreateResult>;
  readonly update: (
    ctx: PersisterContext,
    payload: TPayload,
    existingId: string,
  ) => Promise<PersisterUpdateResult>;
}
