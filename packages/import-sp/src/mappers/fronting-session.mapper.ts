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
import { brandId, brandValue } from "@pluralscape/types";

import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPFrontHistory } from "../sources/sp-types.js";
import type {
  CustomFrontId,
  FrontingSessionComment,
  FrontingSessionEncryptedInput,
  MemberId,
} from "@pluralscape/types";
import type { CreateFrontingSessionBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type MappedFrontingSession = Omit<
  z.infer<typeof CreateFrontingSessionBodySchema>,
  "encryptedData" | "endTime"
> & {
  readonly encrypted: FrontingSessionEncryptedInput;
  readonly endTime: number | null;
};

export function mapFrontingSession(
  sp: SPFrontHistory,
  ctx: MappingContext,
): MapperResult<MappedFrontingSession> {
  const entityType = sp.custom ? "custom-front" : "member";
  const resolved = ctx.translate(entityType, sp.member);
  if (resolved === null) {
    return failed({
      kind: "fk-miss",
      message: `FK miss: ${entityType} ${sp.member} not in translation table`,
      missingRefs: [sp.member],
      targetField: "member",
    });
  }

  const endTime = sp.live ? null : (sp.endTime ?? null);

  const encrypted: FrontingSessionEncryptedInput = {
    // SP source may carry an empty `customStatus` string for sessions with no
    // user-entered note. The Pluralscape brand requires non-empty when present,
    // so coerce empty/missing alike to null at the boundary.
    comment: sp.customStatus?.length ? brandValue<FrontingSessionComment>(sp.customStatus) : null,
    positionality: null,
    outtrigger: null,
    outtriggerSentiment: null,
  };

  const memberId = sp.custom ? undefined : brandId<MemberId>(resolved);
  const customFrontId = sp.custom ? brandId<CustomFrontId>(resolved) : undefined;

  const payload: MappedFrontingSession = {
    encrypted,
    startTime: sp.startTime,
    endTime,
    memberId,
    customFrontId,
    structureEntityId: undefined,
  };

  // Persist subject IDs so the fronting-comment mapper can inherit them —
  // SP comments don't carry their own subject, only a session reference.
  ctx.storeMetadata("fronting-session", sp._id, "memberId", memberId);
  ctx.storeMetadata("fronting-session", sp._id, "customFrontId", customFrontId);

  return mapped(payload);
}
