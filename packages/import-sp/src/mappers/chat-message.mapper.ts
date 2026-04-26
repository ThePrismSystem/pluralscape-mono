/**
 * Chat message mapper.
 *
 * SP `chatMessages` → Pluralscape chat messages. Resolves channel, writer,
 * and (optional) `replyTo` through the translation table. Fail-closed on
 * every FK miss: an unresolvable channel, writer, or replyTo all surface as
 * `MapperResult.failed` with `kind: "fk-miss"`, the offending source ref in
 * `missingRefs`, and the field name in `targetField`. The engine records
 * each failure and continues — callers never see a partially-materialised
 * message.
 */
import { brandId } from "@pluralscape/types";

import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPChatMessage } from "../sources/sp-types.js";
import type { ChatMessageEncryptedInput, MemberId } from "@pluralscape/types";
import type { CreateMessageBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type MappedChatMessage = Omit<z.infer<typeof CreateMessageBodySchema>, "encryptedData"> & {
  readonly encrypted: ChatMessageEncryptedInput;
  readonly channelId: string;
};

export function mapChatMessage(
  sp: SPChatMessage,
  ctx: MappingContext,
): MapperResult<MappedChatMessage> {
  const channelId = ctx.translate("channel", sp.channel);
  if (channelId === null) {
    return failed({
      kind: "fk-miss",
      message: `FK miss: channel ${sp.channel} not in translation table`,
      missingRefs: [sp.channel],
      targetField: "channel",
    });
  }
  const senderId = ctx.translate("member", sp.writer);
  if (senderId === null) {
    return failed({
      kind: "fk-miss",
      message: `FK miss: member ${sp.writer} not in translation table`,
      missingRefs: [sp.writer],
      targetField: "writer",
    });
  }

  let replyToId: MappedChatMessage["replyToId"] = undefined;
  if (sp.replyTo !== undefined && sp.replyTo !== null) {
    const resolved = ctx.translate("chat-message", sp.replyTo);
    if (resolved === null) {
      return failed({
        kind: "fk-miss",
        message: `FK miss: replyTo ${sp.replyTo} not in translation table`,
        missingRefs: [sp.replyTo],
        targetField: "replyTo",
      });
    }
    replyToId = resolved as MappedChatMessage["replyToId"];
  }

  const encrypted: ChatMessageEncryptedInput = {
    content: sp.message,
    senderId: brandId<MemberId>(senderId),
    attachments: [],
    mentions: [],
  };

  const payload: MappedChatMessage = {
    encrypted,
    channelId,
    timestamp: sp.writtenAt,
    replyToId,
  };
  return mapped(payload);
}
