/**
 * Poll mapper.
 *
 * SP `polls` → Pluralscape polls + poll votes. SP stores votes inline on the
 * poll document, but Pluralscape persists them as a separate collection, so
 * this mapper returns both as a `MappedPoll`.
 *
 * SP polls have no creator field, so `createdByMemberId` is always `undefined`
 * (Plan 1 made this nullable in the Pluralscape schema to accommodate
 * imported polls).
 *
 * Veto votes carry no option and no voter identity; they are encoded as
 * `{optionId: "", memberId: null, isVeto: true}`. Regular votes whose voter
 * can't be resolved become `{memberId: null, isVeto: false}` with a warning —
 * the vote is still preserved, just unattributed.
 */
import { brandId, brandValue } from "@pluralscape/types";

import { parseHexColor } from "./helpers.js";
import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPPoll } from "../sources/sp-types.js";
import type {
  PollEncryptedInput,
  PollOptionId,
  PollOptionLabel,
  PollTitle,
} from "@pluralscape/types";
import type { CreatePollBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export interface MappedPollVote {
  readonly optionId: string;
  readonly memberId: string | null;
  readonly isVeto: boolean;
  readonly comment: string | null;
}

export type MappedPoll = Omit<z.infer<typeof CreatePollBodySchema>, "encryptedData"> & {
  readonly encrypted: PollEncryptedInput;
  readonly votes: readonly MappedPollVote[];
};

export function mapPoll(sp: SPPoll, ctx: MappingContext): MapperResult<MappedPoll> {
  // The PollTitle and PollOptionLabel brands reject empty strings. Guard
  // both at the SP boundary before any downstream branding so a malformed
  // source poll becomes a non-fatal import failure instead of a Zod parse
  // error inside the persister.
  if (sp.name.length === 0) {
    return failed({
      kind: "empty-name",
      message: `poll "${sp._id}" has empty name`,
      targetField: "name",
    });
  }
  const sourceOptions = sp.options ?? [];
  const emptyLabelIndex = sourceOptions.findIndex((o) => o.name.length === 0);
  if (emptyLabelIndex !== -1) {
    return failed({
      kind: "empty-name",
      message: `poll "${sp._id}" option at index ${String(emptyLabelIndex)} has empty label`,
      targetField: "options",
    });
  }

  // SP poll options have an optional `id` field — freshly-created polls ship
  // options without ids. Fall back to a stable positional synthetic id so
  // downstream votes can still reference them by position even without a
  // server-assigned id.
  const options = sourceOptions.map((o, idx) => ({
    id: brandId<PollOptionId>(o.id ?? `${sp._id}_opt_${String(idx)}`),
    label: brandValue<PollOptionLabel>(o.name),
    voteCount: 0,
    color: parseHexColor(o.color),
    emoji: null,
  }));

  const hasInvalidOptionColor = sourceOptions.some(
    (o) =>
      o.color !== undefined &&
      o.color !== null &&
      o.color !== "" &&
      parseHexColor(o.color) === null,
  );
  if (hasInvalidOptionColor) {
    ctx.addWarningOnce(`invalid-hex-color:poll:${sp._id}`, {
      entityType: "poll",
      entityId: sp._id,
      message: `Poll "${sp._id}" has option(s) with invalid color dropped (not valid hex)`,
    });
  }

  const votes: MappedPollVote[] = [];
  const missingVoterRefs: string[] = [];
  for (const v of sp.votes ?? []) {
    if (v.vote === "veto") {
      votes.push({
        optionId: "",
        memberId: null,
        isVeto: true,
        comment: v.comment ?? null,
      });
      continue;
    }
    const resolved = ctx.translate("member", v.id);
    if (resolved === null) {
      missingVoterRefs.push(v.id);
    } else {
      votes.push({
        optionId: v.vote,
        memberId: resolved,
        isVeto: false,
        comment: v.comment ?? null,
      });
    }
  }

  if (missingVoterRefs.length > 0) {
    return failed({
      kind: "fk-miss",
      message: `poll ${sp._id} has ${String(missingVoterRefs.length)} unresolved voter reference(s)`,
      missingRefs: missingVoterRefs,
      targetField: "votes",
    });
  }

  const encrypted: PollEncryptedInput = {
    title: brandValue<PollTitle>(sp.name),
    description: sp.desc ?? null,
    options,
  };

  const payload: MappedPoll = {
    encrypted,
    votes,
    kind: sp.custom === true ? "custom" : "standard",
    createdByMemberId: undefined,
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: sp.allowAbstain ?? false,
    allowVeto: sp.allowVeto ?? false,
    endsAt: sp.endTime ?? undefined,
  };

  return mapped(payload);
}
