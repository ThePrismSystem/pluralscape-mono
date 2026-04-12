/**
 * Poll mapper.
 *
 * SP `polls` → Pluralscape polls + poll votes. SP stores votes inline on the
 * poll document, but Pluralscape persists them as a separate collection, so
 * this mapper returns both as a `MappedPollOutput`.
 *
 * SP polls have no creator field, so `createdByMemberId` is always `null`
 * (Plan 1 made this nullable in the Pluralscape schema to accommodate
 * imported polls).
 *
 * Veto votes carry no option and no voter identity; they are encoded as
 * `{optionId: "", memberId: null, isVeto: true}`. Regular votes whose voter
 * can't be resolved become `{memberId: null, isVeto: false}` with a warning —
 * the vote is still preserved, just unattributed.
 */
import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPPoll } from "../sources/sp-types.js";

export interface MappedPollOption {
  readonly id: string;
  readonly label: string;
  readonly color: string | null;
}

export interface MappedPollVote {
  readonly optionId: string;
  readonly memberId: string | null;
  readonly isVeto: boolean;
  readonly comment: string | null;
}

export interface MappedPollCore {
  readonly title: string;
  readonly description: string | null;
  readonly endsAt: number | null;
  readonly kind: "standard" | "custom";
  readonly allowAbstain: boolean;
  readonly allowVeto: boolean;
  readonly createdByMemberId: string | null;
  readonly options: readonly MappedPollOption[];
}

export interface MappedPollOutput {
  readonly poll: MappedPollCore;
  readonly votes: readonly MappedPollVote[];
}

/**
 * Canonical name for the persister payload. The poll mapper produces
 * {@link MappedPollOutput}; this alias aligns the entity-level name with the
 * rest of the `Mapped<Entity>` family consumed by {@link PersistableEntity}.
 */
export type MappedPoll = MappedPollOutput;

export function mapPoll(sp: SPPoll, ctx: MappingContext): MapperResult<MappedPollOutput> {
  // SP poll options have an optional `id` field — freshly-created polls ship
  // options without ids. Fall back to a stable positional synthetic id so
  // downstream votes can still reference them by position even without a
  // server-assigned id.
  const options: readonly MappedPollOption[] = (sp.options ?? []).map((o, idx) => ({
    id: o.id ?? `${sp._id}_opt_${String(idx)}`,
    label: o.name,
    color: o.color ?? null,
  }));

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

  const poll: MappedPollCore = {
    title: sp.name,
    description: sp.desc ?? null,
    endsAt: sp.endTime ?? null,
    kind: sp.custom === true ? "custom" : "standard",
    allowAbstain: sp.allowAbstain ?? false,
    allowVeto: sp.allowVeto ?? false,
    createdByMemberId: null,
    options,
  };

  const payload: MappedPollOutput = { poll, votes };
  return mapped(payload);
}
