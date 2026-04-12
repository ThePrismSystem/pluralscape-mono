/**
 * Poll persister (with votes fan-out).
 *
 * The Plan 2 `poll.mapper.ts` emits `{ poll, votes }` — the poll core
 * (title, description, options, etc.) plus an array of vote records
 * inline. This helper encrypts the poll and issues `poll.create` /
 * `poll.update`, then fans out one `poll.castVote` per vote via the
 * shared `castPollVotes` helper.
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

export interface PollCorePayload {
  readonly title: string;
  readonly description: string | null;
  readonly endsAt: number | null;
  readonly kind: "standard" | "custom";
  readonly allowAbstain: boolean;
  readonly allowVeto: boolean;
  readonly createdByMemberId: string | null;
  readonly options: readonly {
    readonly id: string;
    readonly label: string;
    readonly color: string | null;
  }[];
}

export interface PollOutputPayload {
  readonly poll: PollCorePayload;
  readonly votes: readonly PollVoteInput[];
}

function isPollCore(value: unknown): value is PollCorePayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record["title"] === "string" && Array.isArray(record["options"]);
}

function isPollOutputPayload(value: unknown): value is PollOutputPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return "poll" in record && isPollCore(record["poll"]) && Array.isArray(record["votes"]);
}

/** Default max votes when multiple votes are not allowed. */
const SINGLE_VOTE_MAX = 1;

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isPollOutputPayload, "poll");
  const encrypted = encryptForCreate(narrowed.poll, ctx.masterKey);
  const result = await ctx.api.poll.create(ctx.systemId, {
    encryptedData: encrypted.encryptedData,
    kind: narrowed.poll.kind,
    allowMultipleVotes: false,
    maxVotesPerMember: SINGLE_VOTE_MAX,
    allowAbstain: narrowed.poll.allowAbstain,
    allowVeto: narrowed.poll.allowVeto,
  });
  await castPollVotes(ctx, result.id, narrowed.votes);
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isPollOutputPayload, "poll");
  const encrypted = encryptForUpdate(narrowed.poll, 1, ctx.masterKey);
  const result = await ctx.api.poll.update(ctx.systemId, existingId, encrypted);
  await castPollVotes(ctx, result.id, narrowed.votes);
  return { pluralscapeEntityId: result.id };
}

export const pollPersister: EntityPersister = { create, update };
