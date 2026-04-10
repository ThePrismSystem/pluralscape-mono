/**
 * Shared helper functions used by every per-entity persister.
 *
 * Centralised here so each entity file stays small and the assertion,
 * encryption, and fan-out patterns have a single implementation and a
 * single test file.
 */

import { encryptInput, encryptUpdate } from "@pluralscape/data/transforms/decode-blob";

import type {
  EncryptedInput,
  EncryptedUpdate,
  IdTranslationTable,
  PersisterContext,
  VersionedEntityRef,
} from "./persister.types.js";
import type { KdfMasterKey } from "@pluralscape/crypto";

/**
 * Resolve the Pluralscape entity ID for a source-side record, if any.
 *
 * Thin wrapper around `IdTranslationTable.get` that centralises the lookup
 * so every persister uses the same null-contract and we can change the
 * underlying store without touching 17 files.
 */
export function resolveExistingId(
  idTranslation: IdTranslationTable,
  sourceEntityType: string,
  sourceEntityId: string,
): string | null {
  return idTranslation.get(sourceEntityType, sourceEntityId);
}

// ── assertPayloadShape ───────────────────────────────────────────────

/**
 * Narrow the opaque `unknown` payload a persister receives from the
 * engine using a caller-supplied type guard.
 *
 * Throws a deterministic `Error` when the guard rejects, so the error
 * message threads through `classifyError` in the engine.
 *
 * Use this instead of `as` casts — the type system cannot vouch for data
 * that crosses the `Persister` boundary without an explicit check.
 */
export function assertPayloadShape<T>(
  payload: unknown,
  guard: (value: unknown) => value is T,
  entityType: string,
): T {
  if (!guard(payload)) {
    throw new Error(`Persister received invalid payload for ${entityType}`);
  }
  return payload;
}

// ── Encryption wrappers ──────────────────────────────────────────────

/**
 * Encrypt a plaintext payload for a create mutation.
 *
 * Thin pass-through to `@pluralscape/data`'s generic `encryptInput` helper.
 * Kept as a separate export so persister code imports from the local
 * module and the encryption path can be swapped for a bucket-keyed
 * (tier 2) variant in the future without editing every helper.
 */
export function encryptForCreate(data: unknown, masterKey: KdfMasterKey): EncryptedInput {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt a plaintext payload for an update mutation.
 *
 * Returns both `encryptedData` and the caller-supplied `version` so the
 * server can enforce optimistic locking.
 */
export function encryptForUpdate(
  data: unknown,
  version: number,
  masterKey: KdfMasterKey,
): EncryptedUpdate {
  return encryptUpdate(data, version, masterKey);
}

// ── Channels-table shared writer ─────────────────────────────────────

/**
 * Input for the shared channels-table writer.
 *
 * Both channel categories and channels live in the same DB table keyed
 * by the `type` discriminator. The plaintext (name, description, colour)
 * must already be encrypted by the caller so this helper does not touch
 * the master key.
 */
export interface ChannelsTableInput {
  readonly encryptedData: string;
  readonly parentId: string | null;
  readonly sortOrder: number;
}

/**
 * Shared writer for the two channel-shaped entities.
 *
 * `type` picks the discriminator; `parentId` is `null` for categories (a
 * category cannot sit beneath another category) and the resolved parent
 * category ID for channels.
 */
export async function persistViaChannelsTable(
  ctx: PersisterContext,
  input: ChannelsTableInput,
  type: "category" | "channel",
): Promise<VersionedEntityRef> {
  return ctx.api.channel.create(ctx.systemId, {
    encryptedData: input.encryptedData,
    type,
    parentId: input.parentId,
    sortOrder: input.sortOrder,
  });
}

// ── castPollVotes ────────────────────────────────────────────────────

/** Plaintext shape of a poll vote before encryption. */
export interface PollVoteInput {
  readonly optionId: string;
  readonly memberId: string | null;
  readonly isVeto: boolean;
  readonly comment: string | null;
}

/**
 * Fan out one `poll.castVote` call per vote, sequentially.
 *
 * Sequential dispatch avoids overwhelming the API — polls with hundreds
 * of votes are rare and the ordering gives us a deterministic test shape.
 * Each vote is encrypted independently so that callers inspecting the
 * output never see a decrypted vote payload on the wire.
 */
export async function castPollVotes(
  ctx: PersisterContext,
  pollId: string,
  votes: readonly PollVoteInput[],
): Promise<void> {
  for (const vote of votes) {
    const encrypted = encryptForCreate(
      {
        optionId: vote.optionId,
        isVeto: vote.isVeto,
        comment: vote.comment,
      },
      ctx.masterKey,
    );
    await ctx.api.poll.castVote(ctx.systemId, {
      pollId,
      memberId: vote.memberId,
      encryptedData: encrypted.encryptedData,
    });
  }
}

// ── Ref upsert queue helper ──────────────────────────────────────────

/**
 * Enqueue a new source→target mapping on the persister's ref-upsert
 * queue. A thin wrapper so each persister file does not import the
 * context API surface directly — the persister wiring owns the batching
 * strategy, not the helpers.
 */
export function queueRefUpsert(
  ctx: PersisterContext,
  sourceEntityType: string,
  sourceEntityId: string,
  pluralscapeEntityId: string,
): void {
  ctx.queueRefUpsert(sourceEntityType, sourceEntityId, pluralscapeEntityId);
}
