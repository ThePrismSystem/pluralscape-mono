import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import {
  brandedId,
  sqliteEncryptedBlob,
  sqliteJson,
  sqliteTimestamp,
} from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { enumCheck, nullPairCheck } from "../../helpers/check.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.sqlite.js";
import {
  CHANNEL_TYPES,
  NOTE_AUTHOR_ENTITY_TYPES,
  POLL_KINDS,
  POLL_STATUSES,
} from "../../helpers/enums.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type {
  AcknowledgementId,
  AnyBrandedId,
  BoardMessageId,
  ChannelServerMetadata,
  ChannelId,
  MemberId,
  MessageId,
  NoteAuthorEntityType,
  NoteId,
  PollId,
  PollOptionId,
  PollServerMetadata,
  PollVoteId,
  PollVoteServerMetadata,
  SystemId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const channels = sqliteTable(
  "channels",
  {
    ...entityIdentity<ChannelId>(),
    type: text("type").notNull().$type<ChannelServerMetadata["type"]>(),
    parentId: brandedId<ChannelId>("parent_id"),
    sortOrder: integer("sort_order").notNull(),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("channels_system_archived_idx").on(t.systemId, t.archived),
    index("channels_parent_id_idx").on(t.parentId),
    unique("channels_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.parentId, t.systemId],
      foreignColumns: [t.id, t.systemId],
    }).onDelete("restrict"),
    check("channels_type_check", enumCheck(t.type, CHANNEL_TYPES)),
    check("channels_sort_order_check", sql`${t.sortOrder} >= 0`),
    ...serverEntityChecks("channels", t),
  ],
);

// `messages` uses a composite primary key (id, timestamp) for partitioning.
// `id` is not the sole PK, so this table cannot use entityIdentity().
export const messages = sqliteTable(
  "messages",
  {
    id: brandedId<MessageId>("id").notNull(),
    channelId: brandedId<ChannelId>("channel_id").notNull(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    replyToId: brandedId<MessageId>("reply_to_id"),
    timestamp: sqliteTimestamp("timestamp").notNull(),
    editedAt: sqliteTimestamp("edited_at"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.timestamp] }),
    unique("messages_id_unique").on(t.id, t.timestamp),
    index("messages_channel_id_timestamp_idx").on(t.channelId, t.timestamp),
    index("messages_system_archived_idx").on(t.systemId, t.archived),
    index("messages_reply_to_id_idx").on(t.replyToId),
    unique("messages_id_system_id_timestamp_unique").on(t.id, t.systemId, t.timestamp),
    foreignKey({
      columns: [t.channelId, t.systemId],
      foreignColumns: [channels.id, channels.systemId],
    }).onDelete("restrict"),
    // reply_to_id is a soft reference — no FK constraint.
    // PG can't self-FK on a single column when PK is composite (id, timestamp).
    ...serverEntityChecks("messages", t),
  ],
);

export const boardMessages = sqliteTable(
  "board_messages",
  {
    ...entityIdentity<BoardMessageId>(),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("board_messages_system_archived_idx").on(t.systemId, t.archived),
    index("board_messages_system_archived_sort_idx").on(t.systemId, t.archived, t.sortOrder, t.id),
    check("board_messages_sort_order_check", sql`${t.sortOrder} >= 0`),
    ...serverEntityChecks("board_messages", t),
  ],
);

export const notes = sqliteTable(
  "notes",
  {
    ...entityIdentity<NoteId>(),
    authorEntityType: text("author_entity_type").$type<NoteAuthorEntityType>(),
    // Polymorphic: targets member or structure-entity — discriminator lives in
    // `authorEntityType`. Brand-level narrowing happens at the application
    // layer (`brandedId<AnyBrandedId>` intentionally permissive here).
    authorEntityId: brandedId<AnyBrandedId>("author_entity_id"),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("notes_system_archived_idx").on(t.systemId, t.archived),
    index("notes_system_archived_created_idx").on(t.systemId, t.archived, t.createdAt, t.id),
    index("notes_system_author_type_archived_idx").on(t.systemId, t.authorEntityType, t.archived),
    index("notes_author_entity_id_idx").on(t.authorEntityId),
    check("notes_author_null_pair_check", nullPairCheck(t.authorEntityType, t.authorEntityId)),
    check(
      "notes_author_entity_type_check",
      enumCheck(t.authorEntityType, NOTE_AUTHOR_ENTITY_TYPES),
    ),
    ...serverEntityChecks("notes", t),
  ],
);

export const polls = sqliteTable(
  "polls",
  {
    ...entityIdentity<PollId>(),
    createdByMemberId: brandedId<MemberId>("created_by_member_id"),
    kind: text("kind").notNull().$type<PollServerMetadata["kind"]>(),
    status: text("status").notNull().default("open").$type<PollServerMetadata["status"]>(),
    closedAt: sqliteTimestamp("closed_at"),
    endsAt: sqliteTimestamp("ends_at"),
    allowMultipleVotes: integer("allow_multiple_votes", { mode: "boolean" }).notNull(),
    maxVotesPerMember: integer("max_votes_per_member").notNull(),
    allowAbstain: integer("allow_abstain", { mode: "boolean" }).notNull(),
    allowVeto: integer("allow_veto", { mode: "boolean" }).notNull(),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("polls_system_archived_idx").on(t.systemId, t.archived),
    index("polls_system_archived_created_idx").on(t.systemId, t.archived, t.createdAt, t.id),
    unique("polls_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.createdByMemberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
    check("polls_status_check", enumCheck(t.status, POLL_STATUSES)),
    check("polls_kind_check", enumCheck(t.kind, POLL_KINDS)),
    check("polls_max_votes_check", sql`${t.maxVotesPerMember} >= 1`),
    ...serverEntityChecks("polls", t),
  ],
);

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    ...entityIdentity<PollVoteId>(),
    pollId: brandedId<PollId>("poll_id").notNull(),
    optionId: brandedId<PollOptionId>("option_id"),
    voter: sqliteJson("voter").$type<PollVoteServerMetadata["voter"]>(),
    isVeto: integer("is_veto", { mode: "boolean" }).notNull().default(false),
    votedAt: sqliteTimestamp("voted_at").notNull(),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("poll_votes_poll_id_idx").on(t.pollId),
    index("poll_votes_poll_created_idx").on(t.pollId, t.createdAt, t.id),
    index("poll_votes_system_archived_idx").on(t.systemId, t.archived),
    foreignKey({
      columns: [t.pollId, t.systemId],
      foreignColumns: [polls.id, polls.systemId],
    }).onDelete("restrict"),
    check("poll_votes_voter_not_null", sql`${t.voter} IS NOT NULL`),
    ...serverEntityChecks("poll_votes", t),
  ],
);

export const acknowledgements = sqliteTable(
  "acknowledgements",
  {
    ...entityIdentity<AcknowledgementId>(),
    createdByMemberId: brandedId<MemberId>("created_by_member_id"),
    confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("acknowledgements_system_id_confirmed_idx").on(t.systemId, t.confirmed),
    index("acknowledgements_system_archived_idx").on(t.systemId, t.archived),
    index("acknowledgements_system_archived_created_idx").on(
      t.systemId,
      t.archived,
      t.createdAt,
      t.id,
    ),
    foreignKey({
      columns: [t.createdByMemberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
    ...serverEntityChecks("acknowledgements", t),
  ],
);

export type ChannelRow = InferSelectModel<typeof channels>;
export type NewChannel = InferInsertModel<typeof channels>;
export type MessageRow = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;
export type BoardMessageRow = InferSelectModel<typeof boardMessages>;
export type NewBoardMessage = InferInsertModel<typeof boardMessages>;
export type NoteRow = InferSelectModel<typeof notes>;
export type NewNote = InferInsertModel<typeof notes>;
export type PollRow = InferSelectModel<typeof polls>;
export type NewPoll = InferInsertModel<typeof polls>;
export type PollVoteRow = InferSelectModel<typeof pollVotes>;
export type NewPollVote = InferInsertModel<typeof pollVotes>;
export type AcknowledgementRow = InferSelectModel<typeof acknowledgements>;
export type NewAcknowledgement = InferInsertModel<typeof acknowledgements>;
