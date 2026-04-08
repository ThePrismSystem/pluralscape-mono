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
import { mapped, type MapperResult } from "./mapper-result.js";

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

const VETO_SENTINEL = "veto";

export function mapPoll(sp: SPPoll, ctx: MappingContext): MapperResult<MappedPollOutput> {
  const options: readonly MappedPollOption[] = sp.options.map((o) => ({
    id: o.id,
    label: o.name,
    color: o.color ?? null,
  }));

  const votes: MappedPollVote[] = [];
  for (const v of sp.votes ?? []) {
    if (v.vote === VETO_SENTINEL) {
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
      ctx.addWarning({
        entityType: "poll",
        entityId: sp._id,
        message: `poll voter ${v.id} not in translation table; keeping vote unattributed`,
      });
    }
    votes.push({
      optionId: v.vote,
      memberId: resolved,
      isVeto: false,
      comment: v.comment ?? null,
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
