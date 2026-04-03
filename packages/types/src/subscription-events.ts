import type { AcknowledgementId, BoardMessageId, ChannelId, MessageId, PollId } from "./ids.js";

interface BaseChangeEvent<TEntity extends string, TType extends string> {
  readonly entity: TEntity;
  readonly type: TType;
}

export type MessageChangeType = "created" | "updated" | "archived" | "deleted";

export interface MessageChangeEvent extends BaseChangeEvent<"message", MessageChangeType> {
  readonly messageId: MessageId;
  readonly channelId: ChannelId;
}

export type BoardMessageChangeType =
  | "created"
  | "updated"
  | "archived"
  | "deleted"
  | "pinned"
  | "unpinned"
  | "reordered";

export interface BoardMessageChangeEvent extends BaseChangeEvent<
  "boardMessage",
  BoardMessageChangeType
> {
  readonly boardMessageId: BoardMessageId;
}

export type PollChangeType = "created" | "updated" | "closed" | "voteCast" | "archived" | "deleted";

export interface PollChangeEvent extends BaseChangeEvent<"poll", PollChangeType> {
  readonly pollId: PollId;
}

export type AcknowledgementChangeType =
  | "created"
  | "updated"
  | "confirmed"
  | "archived"
  | "deleted";

export interface AcknowledgementChangeEvent extends BaseChangeEvent<
  "acknowledgement",
  AcknowledgementChangeType
> {
  readonly ackId: AcknowledgementId;
}

export type EntityChangeEvent =
  | MessageChangeEvent
  | BoardMessageChangeEvent
  | PollChangeEvent
  | AcknowledgementChangeEvent;
