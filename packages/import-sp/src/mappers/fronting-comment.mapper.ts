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

export interface MappedFrontingComment {
  readonly frontingSessionId: string;
  readonly body: string;
  readonly createdAt: number;
}

export function mapFrontingComment(
  sp: SPComment,
  ctx: MappingContext,
): MapperResult<MappedFrontingComment> {
  const resolved = ctx.translate("fronting-session", sp.documentId);
  if (resolved === null) {
    return failed(`FK miss: fronting-session ${sp.documentId} not in translation table`);
  }

  const payload: MappedFrontingComment = {
    frontingSessionId: resolved,
    body: sp.text,
    createdAt: sp.time,
  };
  return mapped(payload);
}
