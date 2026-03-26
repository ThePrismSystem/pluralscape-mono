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

import { sqliteEncryptedBlob, sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.sqlite.js";
import { enumCheck, nullPairCheck } from "../../helpers/check.js";
import {
  CHANNEL_TYPES,
  NOTE_AUTHOR_ENTITY_TYPES,
  POLL_KINDS,
  POLL_STATUSES,
} from "../../helpers/enums.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type { ServerChannel, ServerPoll, ServerPollVote } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    type: text("type").notNull().$type<ServerChannel["type"]>(),
    parentId: text("parent_id"),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
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
    versionCheckFor("channels", t.version),
    archivableConsistencyCheckFor("channels", t.archived, t.archivedAt),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").notNull(),
    channelId: text("channel_id").notNull(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    replyToId: text("reply_to_id"),
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
    versionCheckFor("messages", t.version),
    archivableConsistencyCheckFor("messages", t.archived, t.archivedAt),
  ],
);

export const boardMessages = sqliteTable(
  "board_messages",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("board_messages_system_archived_idx").on(t.systemId, t.archived),
    index("board_messages_system_archived_sort_idx").on(t.systemId, t.archived, t.sortOrder, t.id),
    check("board_messages_sort_order_check", sql`${t.sortOrder} >= 0`),
    versionCheckFor("board_messages", t.version),
    archivableConsistencyCheckFor("board_messages", t.archived, t.archivedAt),
  ],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    authorEntityType: text("author_entity_type"),
    authorEntityId: text("author_entity_id"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
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
    versionCheckFor("notes", t.version),
    archivableConsistencyCheckFor("notes", t.archived, t.archivedAt),
  ],
);

export const polls = sqliteTable(
  "polls",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    createdByMemberId: text("created_by_member_id"),
    kind: text("kind").notNull().$type<ServerPoll["kind"]>(),
    status: text("status").notNull().default("open").$type<ServerPoll["status"]>(),
    closedAt: sqliteTimestamp("closed_at"),
    endsAt: sqliteTimestamp("ends_at"),
    allowMultipleVotes: integer("allow_multiple_votes", { mode: "boolean" }).notNull(),
    maxVotesPerMember: integer("max_votes_per_member").notNull(),
    allowAbstain: integer("allow_abstain", { mode: "boolean" }).notNull(),
    allowVeto: integer("allow_veto", { mode: "boolean" }).notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
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
    versionCheckFor("polls", t.version),
    archivableConsistencyCheckFor("polls", t.archived, t.archivedAt),
  ],
);

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id").notNull(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    optionId: text("option_id"),
    voter: sqliteJson("voter").$type<ServerPollVote["voter"]>(),
    isVeto: integer("is_veto", { mode: "boolean" }).notNull().default(false),
    votedAt: sqliteTimestamp("voted_at").notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
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
    archivableConsistencyCheckFor("poll_votes", t.archived, t.archivedAt),
  ],
);

export const acknowledgements = sqliteTable(
  "acknowledgements",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    createdByMemberId: text("created_by_member_id"),
    confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
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
    versionCheckFor("acknowledgements", t.version),
    archivableConsistencyCheckFor("acknowledgements", t.archived, t.archivedAt),
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
