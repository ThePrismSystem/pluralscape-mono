import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteBinary, sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { CHANNEL_TYPES, POLL_KINDS, POLL_STATUSES } from "../../helpers/enums.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type { ServerChannel, ServerPoll } from "@pluralscape/types";

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
    encryptedData: sqliteBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("channels_system_id_idx").on(t.systemId),
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    check("channels_type_check", enumCheck(t.type, CHANNEL_TYPES)),
    check("channels_sort_order_check", sql`${t.sortOrder} >= 0`),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull(),
    replyToId: text("reply_to_id"),
    timestamp: sqliteTimestamp("timestamp").notNull(),
    editedAt: sqliteTimestamp("edited_at"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    encryptedData: sqliteBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("messages_channel_id_timestamp_idx").on(t.channelId, t.timestamp),
    index("messages_system_id_idx").on(t.systemId),
  ],
);

export const boardMessages = sqliteTable(
  "board_messages",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull(),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: sqliteBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("board_messages_system_id_idx").on(t.systemId)],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    memberId: text("member_id").references(() => members.id, { onDelete: "set null" }),
    encryptedData: sqliteBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [index("notes_system_id_idx").on(t.systemId), index("notes_member_id_idx").on(t.memberId)],
);

export const polls = sqliteTable(
  "polls",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    createdByMemberId: text("created_by_member_id").notNull(),
    kind: text("kind").notNull().$type<ServerPoll["kind"]>(),
    status: text("status").notNull().default("open").$type<ServerPoll["status"]>(),
    closedAt: sqliteTimestamp("closed_at"),
    endsAt: sqliteTimestamp("ends_at"),
    allowMultipleVotes: integer("allow_multiple_votes", { mode: "boolean" }).notNull(),
    maxVotesPerMember: integer("max_votes_per_member").notNull(),
    allowAbstain: integer("allow_abstain", { mode: "boolean" }).notNull(),
    allowVeto: integer("allow_veto", { mode: "boolean" }).notNull(),
    encryptedData: sqliteBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("polls_system_id_idx").on(t.systemId),
    check("polls_kind_check", enumCheck(t.kind, POLL_KINDS)),
    check("polls_status_check", enumCheck(t.status, POLL_STATUSES)),
  ],
);

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    optionId: text("option_id"),
    voter: sqliteJson("voter").notNull(),
    isVeto: integer("is_veto", { mode: "boolean" }).notNull().default(false),
    votedAt: sqliteTimestamp("voted_at").notNull(),
    encryptedData: sqliteBinary("encrypted_data"),
  },
  (t) => [
    index("poll_votes_poll_id_idx").on(t.pollId),
    index("poll_votes_system_id_idx").on(t.systemId),
  ],
);

export const acknowledgements = sqliteTable(
  "acknowledgements",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    createdByMemberId: text("created_by_member_id").notNull(),
    targetMemberId: text("target_member_id").notNull(),
    confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
    confirmedAt: sqliteTimestamp("confirmed_at"),
    encryptedData: sqliteBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("acknowledgements_system_id_idx").on(t.systemId),
    index("acknowledgements_confirmed_idx").on(t.confirmed),
  ],
);
