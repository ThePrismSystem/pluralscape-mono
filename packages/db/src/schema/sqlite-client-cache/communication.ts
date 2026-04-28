import { foreignKey, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type {
  AcknowledgementId,
  BlobId,
  BoardMessageId,
  ChannelId,
  HexColor,
  MemberId,
  MessageId,
  NoteAuthorEntityType,
  NoteId,
  PollId,
  PollKind,
  PollOption,
  PollOptionId,
  PollStatus,
  PollVoteId,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const channels = sqliteTable("channels", {
  ...entityIdentity<ChannelId>(),
  name: text("name").notNull(),
  type: text("type").$type<"category" | "channel">().notNull(),
  parentId: brandedId<ChannelId>("parent_id"),
  sortOrder: integer("sort_order").notNull(),
  ...timestamps(),
  ...archivable(),
});

/**
 * Decrypted client-cache projection of `ChatMessage`. Composite PK on
 * (id, timestamp) is partition-only on the server; the cache uses a simple
 * PK because messages aren't partitioned client-side.
 */
export const messages = sqliteTable(
  "messages",
  {
    ...entityIdentity<MessageId>(),
    channelId: brandedId<ChannelId>("channel_id").notNull(),
    senderId: brandedId<MemberId>("sender_id").notNull(),
    content: text("content").notNull(),
    attachments: sqliteJsonOf<readonly BlobId[]>("attachments").notNull(),
    mentions: sqliteJsonOf<readonly MemberId[]>("mentions").notNull(),
    replyToId: brandedId<MessageId>("reply_to_id"),
    timestamp: sqliteTimestamp("timestamp").notNull(),
    editedAt: sqliteTimestamp("edited_at"),
    ...timestamps(),
    ...archivable(),
  },
  (t) => [
    foreignKey({
      columns: [t.channelId, t.systemId],
      foreignColumns: [channels.id, channels.systemId],
    }).onDelete("restrict"),
  ],
);

export const boardMessages = sqliteTable("board_messages", {
  ...entityIdentity<BoardMessageId>(),
  senderId: brandedId<MemberId>("sender_id").notNull(),
  content: text("content").notNull(),
  pinned: integer("pinned", { mode: "boolean" }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  ...timestamps(),
  ...archivable(),
});

/**
 * Decrypted client-cache projection of `Note`. The polymorphic `author`
 * field is flattened into `authorEntityType` + `authorEntityId` for indexed
 * lookups, matching the server-side encoding.
 */
export const notes = sqliteTable("notes", {
  ...entityIdentity<NoteId>(),
  authorEntityType: text("author_entity_type").$type<NoteAuthorEntityType | null>(),
  authorEntityId: brandedId<MemberId | SystemStructureEntityId>("author_entity_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  backgroundColor: text("background_color").$type<HexColor | null>(),
  ...timestamps(),
  ...archivable(),
});

export const polls = sqliteTable("polls", {
  ...entityIdentity<PollId>(),
  createdByMemberId: brandedId<MemberId>("created_by_member_id"),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind").$type<PollKind>().notNull(),
  options: sqliteJsonOf<readonly PollOption[]>("options").notNull(),
  status: text("status").$type<PollStatus>().notNull(),
  closedAt: sqliteTimestamp("closed_at"),
  endsAt: sqliteTimestamp("ends_at"),
  allowMultipleVotes: integer("allow_multiple_votes", { mode: "boolean" }).notNull(),
  maxVotesPerMember: integer("max_votes_per_member").notNull(),
  allowAbstain: integer("allow_abstain", { mode: "boolean" }).notNull(),
  allowVeto: integer("allow_veto", { mode: "boolean" }).notNull(),
  ...timestamps(),
  ...archivable(),
});

/**
 * Decrypted client-cache projection of `PollOption`. Carve-out: poll
 * options have NO server PG table — they live inside the parent poll's
 * `encryptedData` blob server-side. The cache mirrors the CRDT layer's
 * separate-entity representation (lww-map in the "chat" document) so
 * option-edit merges are visible to the local query layer. Columns:
 * `pollId` is the parent ref; `voteCount` is omitted (computed at read
 * time from `pollVotes`). No archivable mixin (poll options are
 * recreated on poll edit, never archived).
 */
export const pollOptions = sqliteTable("poll_options", {
  id: brandedId<PollOptionId>("id").primaryKey(),
  pollId: brandedId<PollId>("poll_id").notNull(),
  label: text("label").notNull(),
  color: text("color").$type<HexColor | null>(),
  emoji: text("emoji"),
});

/**
 * Decrypted client-cache projection of `PollVote`. The polymorphic `voter`
 * field is flattened into discriminator/id columns, matching the server-side
 * encoding.
 */
export const pollVotes = sqliteTable("poll_votes", {
  ...entityIdentity<PollVoteId>(),
  pollId: brandedId<PollId>("poll_id").notNull(),
  optionId: brandedId<PollOptionId>("option_id"),
  voterEntityType: text("voter_entity_type").$type<"member" | "structure-entity">().notNull(),
  voterEntityId: brandedId<MemberId | SystemStructureEntityId>("voter_entity_id").notNull(),
  comment: text("comment"),
  isVeto: integer("is_veto", { mode: "boolean" }).notNull(),
  votedAt: sqliteTimestamp("voted_at").notNull(),
  ...timestamps(),
  ...archivable(),
});

export const acknowledgements = sqliteTable("acknowledgements", {
  ...entityIdentity<AcknowledgementId>(),
  createdByMemberId: brandedId<MemberId>("created_by_member_id"),
  targetMemberId: brandedId<MemberId>("target_member_id").notNull(),
  message: text("message").notNull(),
  confirmed: integer("confirmed", { mode: "boolean" }).notNull(),
  confirmedAt: sqliteTimestamp("confirmed_at"),
  ...timestamps(),
  ...archivable(),
});

// `messages` carve-out: the partition primary key on the server is composite
// (id, timestamp), but the cache uses a simple PK via entityIdentity. The
// partition-related uniqueness constraint is unnecessary in the local replica.

export type LocalChannelRow = InferSelectModel<typeof channels>;
export type NewLocalChannel = InferInsertModel<typeof channels>;
export type LocalMessageRow = InferSelectModel<typeof messages>;
export type NewLocalMessage = InferInsertModel<typeof messages>;
export type LocalBoardMessageRow = InferSelectModel<typeof boardMessages>;
export type NewLocalBoardMessage = InferInsertModel<typeof boardMessages>;
export type LocalNoteRow = InferSelectModel<typeof notes>;
export type NewLocalNote = InferInsertModel<typeof notes>;
export type LocalPollRow = InferSelectModel<typeof polls>;
export type NewLocalPoll = InferInsertModel<typeof polls>;
export type LocalPollOptionRow = InferSelectModel<typeof pollOptions>;
export type NewLocalPollOption = InferInsertModel<typeof pollOptions>;
export type LocalPollVoteRow = InferSelectModel<typeof pollVotes>;
export type NewLocalPollVote = InferInsertModel<typeof pollVotes>;
export type LocalAcknowledgementRow = InferSelectModel<typeof acknowledgements>;
export type NewLocalAcknowledgement = InferInsertModel<typeof acknowledgements>;
