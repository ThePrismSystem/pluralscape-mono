/**
 * Board message mapper.
 *
 * SP `boardMessages` → Pluralscape board messages. Resolves `writer`
 * through the translation table (hard fail on miss — anonymous board
 * messages have no Pluralscape equivalent).
 *
 * `readBy` tracks which SP system members have seen a post; Pluralscape
 * has no equivalent construct yet, so the field is dropped with a single
 * import-wide warning (the same notice would otherwise repeat for every
 * board message in noisy SP exports).
 */
import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPBoardMessage } from "../sources/sp-types.js";

export interface MappedBoardMessage {
  readonly title: string;
  readonly body: string;
  readonly authorMemberId: string;
  readonly createdAt: number;
}

export function mapBoardMessage(
  sp: SPBoardMessage,
  ctx: MappingContext,
): MapperResult<MappedBoardMessage> {
  const authorMemberId = ctx.translate("member", sp.writer);
  if (authorMemberId === null) {
    return failed(`FK miss: member ${sp.writer} not in translation table`);
  }

  if (sp.readBy !== undefined) {
    ctx.addWarningOnce("board-message.readBy-dropped", {
      entityType: "board-message",
      entityId: sp._id,
      message: "SP `readBy` dropped (no Pluralscape equivalent)",
    });
  }

  const payload: MappedBoardMessage = {
    title: sp.title,
    body: sp.message,
    authorMemberId,
    createdAt: sp.writtenAt,
  };
  return mapped(payload);
}
