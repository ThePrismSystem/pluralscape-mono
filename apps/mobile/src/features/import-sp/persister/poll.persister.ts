/**
 * Poll persister (with votes fan-out).
 *
 * The mapper emits `{ encrypted, kind, votes, ... }` — the encrypted
 * poll core (title, description, options) plus structural metadata and
 * an array of vote records inline. This helper encrypts the poll and
 * issues `poll.create` / `poll.update`, then fans out one
 * `poll.castVote` per vote via the shared `castPollVotes` helper.
 */

import {
  assertPayloadShape,
  castPollVotes,
  encryptForCreate,
  encryptForUpdate,
} from "./persister-helpers.js";

import type { PollVoteInput } from "./persister-helpers.js";
import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

export interface PollPayload {
  readonly encrypted: {
    readonly title: string;
    readonly description: string | null;
    readonly options: readonly {
      readonly id: string;
      readonly label: string;
      readonly color: string | null;
    }[];
  };
  readonly kind: "standard" | "custom";
  readonly createdByMemberId: string | null;
  readonly allowMultipleVotes: boolean;
  readonly maxVotesPerMember: number;
  readonly allowAbstain: boolean;
  readonly allowVeto: boolean;
  readonly endsAt: number | null;
  readonly votes: readonly PollVoteInput[];
}

function isPollPayload(value: unknown): value is PollPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  return typeof record["kind"] === "string" && Array.isArray(record["votes"]);
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isPollPayload, "poll");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await ctx.api.poll.create(ctx.systemId, {
    encryptedData: encrypted.encryptedData,
    kind: narrowed.kind,
    allowMultipleVotes: narrowed.allowMultipleVotes,
    maxVotesPerMember: narrowed.maxVotesPerMember,
    allowAbstain: narrowed.allowAbstain,
    allowVeto: narrowed.allowVeto,
  });
  await castPollVotes(ctx, result.id, narrowed.votes);
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isPollPayload, "poll");
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.poll.update(ctx.systemId, existingId, encrypted);
  await castPollVotes(ctx, result.id, narrowed.votes);
  return { pluralscapeEntityId: result.id };
}

export const pollPersister: EntityPersister = { create, update };
