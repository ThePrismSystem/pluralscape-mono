/**
 * Board message mapper.
 *
 * SP `boardMessages` → Pluralscape board messages. Resolves the SP
 * `writtenBy` field (author member `_id`) through the translation table —
 * hard fail on miss, since an anonymous board message has no Pluralscape
 * equivalent.
 *
 * Dropped SP fields:
 * - `writtenFor` — SP models board posts as per-member walls (one recipient
 *   per message). Pluralscape's board is system-wide; the recipient is
 *   surfaced as a one-time dropped-field warning.
 * - `read` — the single-boolean read flag has no Pluralscape equivalent yet.
 */
import { brandId } from "@pluralscape/types";

import { warnDropped } from "./helpers.js";
import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPBoardMessage } from "../sources/sp-types.js";
import type { BoardMessageEncryptedInput, MemberId } from "@pluralscape/types";
import type { CreateBoardMessageBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type MappedBoardMessage = Omit<
  z.infer<typeof CreateBoardMessageBodySchema>,
  "encryptedData"
> & {
  readonly encrypted: BoardMessageEncryptedInput;
  readonly createdAt: number;
};

export function mapBoardMessage(
  sp: SPBoardMessage,
  ctx: MappingContext,
): MapperResult<MappedBoardMessage> {
  const authorMemberId = ctx.translate("member", sp.writtenBy);
  if (authorMemberId === null) {
    return failed({
      kind: "fk-miss",
      message: `FK miss: member ${sp.writtenBy} not in translation table`,
      missingRefs: [sp.writtenBy],
      targetField: "writtenBy",
    });
  }

  if (sp.writtenFor !== undefined) {
    warnDropped(
      ctx,
      "board-message",
      sp._id,
      "writtenFor",
      "Pluralscape board is system-wide; per-recipient addressing not modeled",
    );
  }

  if (sp.read !== undefined) {
    warnDropped(
      ctx,
      "board-message",
      sp._id,
      "read",
      "no Pluralscape equivalent for the read flag",
    );
  }

  const content = sp.title ? `# ${sp.title}\n\n${sp.message}` : sp.message;

  const encrypted: BoardMessageEncryptedInput = {
    content,
    senderId: brandId<MemberId>(authorMemberId),
  };

  const payload: MappedBoardMessage = {
    encrypted,
    sortOrder: 0,
    pinned: false,
    createdAt: sp.writtenAt,
  };
  return mapped(payload);
}
