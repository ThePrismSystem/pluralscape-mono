import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob, sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { archivableConsistencyCheck, enumCheck, versionCheck } from "../../helpers/check.js";
import { CHANNEL_TYPES, POLL_KINDS, POLL_STATUSES } from "../../helpers/enums.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type { ServerChannel, ServerPoll, ServerPollVote } from "@pluralscape/types";

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
    index("channels_system_id_idx").on(t.systemId),
    unique("channels_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    check("channels_type_check", enumCheck(t.type, CHANNEL_TYPES)),
    check("channels_sort_order_check", sql`${t.sortOrder} >= 0`),
    check("channels_version_check", versionCheck(t.version)),
    check(
      "channels_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
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
    index("messages_channel_id_timestamp_idx").on(t.channelId, t.timestamp),
    index("messages_system_id_idx").on(t.systemId),
    index("messages_reply_to_id_idx").on(t.replyToId),
    unique("messages_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.channelId, t.systemId],
      foreignColumns: [channels.id, channels.systemId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.replyToId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    check("messages_version_check", versionCheck(t.version)),
    check(
      "messages_archived_consistency_check",
      archivableConsistencyCheck(t.archived, t.archivedAt),
    ),
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
  },
  (t) => [
    index("board_messages_system_id_idx").on(t.systemId),
    check("board_messages_sort_order_check", sql`${t.sortOrder} >= 0`),
    check("board_messages_version_check", versionCheck(t.version)),
  ],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    memberId: text("member_id"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("notes_system_id_idx").on(t.systemId),
    index("notes_member_id_idx").on(t.memberId),
    foreignKey({
      columns: [t.memberId],
      foreignColumns: [members.id],
    }).onDelete("set null"),
    check("notes_version_check", versionCheck(t.version)),
    check("notes_archived_consistency_check", archivableConsistencyCheck(t.archived, t.archivedAt)),
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
    kind: text("kind").$type<ServerPoll["kind"]>(),
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
  },
  (t) => [
    index("polls_system_id_idx").on(t.systemId),
    unique("polls_id_system_id_unique").on(t.id, t.systemId),
    foreignKey({
      columns: [t.createdByMemberId],
      foreignColumns: [members.id],
    }).onDelete("set null"),
    check("polls_status_check", enumCheck(t.status, POLL_STATUSES)),
    check("polls_kind_check", enumCheck(t.kind, POLL_KINDS)),
    check("polls_max_votes_check", sql`${t.maxVotesPerMember} >= 1`),
    check("polls_version_check", versionCheck(t.version)),
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
    isVeto: integer("is_veto", { mode: "boolean" }),
    votedAt: sqliteTimestamp("voted_at"),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    index("poll_votes_poll_id_idx").on(t.pollId),
    index("poll_votes_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.pollId, t.systemId],
      foreignColumns: [polls.id, polls.systemId],
    }).onDelete("cascade"),
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
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    index("acknowledgements_system_id_idx").on(t.systemId),
    index("acknowledgements_confirmed_idx").on(t.confirmed),
    foreignKey({
      columns: [t.createdByMemberId],
      foreignColumns: [members.id],
    }).onDelete("set null"),
  ],
);
