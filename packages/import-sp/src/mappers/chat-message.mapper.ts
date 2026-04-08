/**
 * Chat message mapper.
 *
 * SP `chatMessages` → Pluralscape chat messages. Resolves channel and
 * writer through the translation table (hard fail on miss — a message
 * without a channel or writer can't be materialised). `replyTo` is
 * soft-resolved: misses become `null` with a warning so the message still
 * lands, just as a top-level post.
 */
import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPChatMessage } from "../sources/sp-types.js";

export interface MappedChatMessage {
  readonly channelId: string;
  readonly writerMemberId: string;
  readonly body: string;
  readonly createdAt: number;
  readonly replyToChatMessageId: string | null;
}

export function mapChatMessage(
  sp: SPChatMessage,
  ctx: MappingContext,
): MapperResult<MappedChatMessage> {
  const channelId = ctx.translate("channel", sp.channel);
  if (channelId === null) {
    return failed(`FK miss: channel ${sp.channel} not in translation table`);
  }
  const writerMemberId = ctx.translate("member", sp.writer);
  if (writerMemberId === null) {
    return failed(`FK miss: member ${sp.writer} not in translation table`);
  }

  let replyToChatMessageId: string | null = null;
  if (sp.replyTo !== undefined && sp.replyTo !== null) {
    const resolved = ctx.translate("chat-message", sp.replyTo);
    if (resolved === null) {
      ctx.addWarning({
        entityType: "chat-message",
        entityId: sp._id,
        message: `replyTo ${sp.replyTo} not in translation table; dropping thread link`,
      });
    } else {
      replyToChatMessageId = resolved;
    }
  }

  const payload: MappedChatMessage = {
    channelId,
    writerMemberId,
    body: sp.message,
    createdAt: sp.writtenAt,
    replyToChatMessageId,
  };
  return mapped(payload);
}
