import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { CHANNEL_TYPES, POLL_STATUSES } from "../../helpers/enums.js";

import { members } from "./members.js";
import { systems } from "./systems.js";

import type { ServerChannel, ServerPoll } from "@pluralscape/types";

export const channels = pgTable(
  "channels",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull().$type<ServerChannel["type"]>(),
    parentId: varchar("parent_id", { length: 255 }),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: pgBinary("encrypted_data").notNull(),
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

export const messages = pgTable(
  "messages",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    channelId: varchar("channel_id", { length: 255 })
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    timestamp: pgTimestamp("timestamp").notNull(),
    editedAt: pgTimestamp("edited_at"),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("messages_channel_id_timestamp_idx").on(t.channelId, t.timestamp),
    index("messages_system_id_idx").on(t.systemId),
  ],
);

export const boardMessages = pgTable(
  "board_messages",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    pinned: boolean("pinned").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("board_messages_system_id_idx").on(t.systemId),
    check("board_messages_sort_order_check", sql`${t.sortOrder} >= 0`),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    memberId: varchar("member_id", { length: 255 }).references(() => members.id, {
      onDelete: "set null",
    }),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [index("notes_system_id_idx").on(t.systemId), index("notes_member_id_idx").on(t.memberId)],
);

export const polls = pgTable(
  "polls",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 255 })
      .notNull()
      .default("open")
      .$type<ServerPoll["status"]>(),
    closedAt: pgTimestamp("closed_at"),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("polls_system_id_idx").on(t.systemId),
    check("polls_status_check", enumCheck(t.status, POLL_STATUSES)),
  ],
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    pollId: varchar("poll_id", { length: 255 })
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgBinary("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("poll_votes_poll_id_idx").on(t.pollId),
    index("poll_votes_system_id_idx").on(t.systemId),
  ],
);

export const acknowledgements = pgTable(
  "acknowledgements",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    confirmed: boolean("confirmed").notNull().default(false),
    confirmedAt: pgTimestamp("confirmed_at"),
    encryptedData: pgBinary("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("acknowledgements_system_id_idx").on(t.systemId),
    index("acknowledgements_confirmed_idx").on(t.confirmed),
  ],
);
