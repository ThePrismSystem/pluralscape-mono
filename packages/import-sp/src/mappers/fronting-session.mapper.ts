/**
 * Fronting session mapper.
 *
 * SP `frontHistory` → Pluralscape fronting sessions. The SP `member` field
 * references either a member ID or a custom-front ID depending on `custom`.
 * Live sessions have no end time regardless of what SP stores. `customStatus`
 * becomes the session's comment.
 *
 * Fails when the FK doesn't resolve — the engine records the failure and
 * moves on (sessions whose referenced member was skipped upstream simply
 * can't be materialised).
 */
import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPFrontHistory } from "../sources/sp-types.js";

export interface MappedFrontingSession {
  readonly memberId: string | null;
  readonly customFrontId: string | null;
  readonly startTime: number;
  readonly endTime: number | null;
  readonly comment: string | null;
}

export function mapFrontingSession(
  sp: SPFrontHistory,
  ctx: MappingContext,
): MapperResult<MappedFrontingSession> {
  const entityType = sp.custom ? "custom-front" : "member";
  const resolved = ctx.translate(entityType, sp.member);
  if (resolved === null) {
    return failed(`FK miss: ${entityType} ${sp.member} not in translation table`);
  }

  const endTime = sp.live ? null : sp.endTime;

  const payload: MappedFrontingSession = {
    memberId: sp.custom ? null : resolved,
    customFrontId: sp.custom ? resolved : null,
    startTime: sp.startTime,
    endTime,
    comment: sp.customStatus ?? null,
  };
  return mapped(payload);
}
