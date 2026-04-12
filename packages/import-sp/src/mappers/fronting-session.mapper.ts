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
import type { FrontingSessionEncryptedFields } from "@pluralscape/data";
import type { CustomFrontId, MemberId, SystemStructureEntityId } from "@pluralscape/types";
import type { CreateFrontingSessionBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type MappedFrontingSession = Omit<
  z.infer<typeof CreateFrontingSessionBodySchema>,
  "encryptedData"
> & {
  readonly encrypted: FrontingSessionEncryptedFields;
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

  const encrypted: FrontingSessionEncryptedFields = {
    comment: sp.customStatus ?? null,
    positionality: null,
    outtrigger: null,
    outtriggerSentiment: null,
  };

  const payload: MappedFrontingSession = {
    encrypted,
    startTime: sp.startTime,
    endTime,
    memberId: sp.custom ? undefined : (resolved as MemberId),
    customFrontId: sp.custom ? (resolved as CustomFrontId) : undefined,
    structureEntityId: undefined as SystemStructureEntityId | undefined,
  };
  return mapped(payload);
}
