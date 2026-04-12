/**
 * Fronting comment mapper.
 *
 * SP `comments` → Pluralscape fronting-session comments. The `documentId`
 * field always references a frontHistory document (SP enforces this in its
 * validateCollection). We resolve that through the translation table and
 * fail the mapping when the session isn't present.
 */
import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPComment } from "../sources/sp-types.js";
import type { FrontingCommentEncryptedFields } from "@pluralscape/data";
import type { CustomFrontId, MemberId, SystemStructureEntityId } from "@pluralscape/types";
import type { CreateFrontingCommentBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type MappedFrontingComment = Omit<
  z.infer<typeof CreateFrontingCommentBodySchema>,
  "encryptedData"
> & {
  readonly encrypted: FrontingCommentEncryptedFields;
  readonly frontingSessionId: string;
  readonly createdAt: number;
};

export function mapFrontingComment(
  sp: SPComment,
  ctx: MappingContext,
): MapperResult<MappedFrontingComment> {
  const resolved = ctx.translate("fronting-session", sp.documentId);
  if (resolved === null) {
    return failed({
      kind: "fk-miss",
      message: `FK miss: fronting-session ${sp.documentId} not in translation table`,
      missingRefs: [sp.documentId],
      targetField: "documentId",
    });
  }

  const encrypted: FrontingCommentEncryptedFields = {
    content: sp.text,
  };

  const payload: MappedFrontingComment = {
    encrypted,
    frontingSessionId: resolved,
    createdAt: sp.time,
    memberId: undefined as MemberId | undefined,
    customFrontId: undefined as CustomFrontId | undefined,
    structureEntityId: undefined as SystemStructureEntityId | undefined,
  };
  return mapped(payload);
}
