import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  varchar,
} from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { archivable, timestamps, versioned } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { CHANNEL_TYPES, POLL_KINDS, POLL_STATUSES } from "../../helpers/enums.js";

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
    senderId: varchar("sender_id", { length: 255 }).notNull(),
    replyToId: varchar("reply_to_id", { length: 255 }),
    timestamp: pgTimestamp("timestamp").notNull(),
    editedAt: pgTimestamp("edited_at"),
    archived: boolean("archived").notNull().default(false),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
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
    senderId: varchar("sender_id", { length: 255 }).notNull(),
    pinned: boolean("pinned").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [index("board_messages_system_id_idx").on(t.systemId)],
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
    createdByMemberId: varchar("created_by_member_id", { length: 255 }).notNull(),
    kind: varchar("kind", { length: 255 }).notNull().$type<ServerPoll["kind"]>(),
    status: varchar("status", { length: 255 })
      .notNull()
      .default("open")
      .$type<ServerPoll["status"]>(),
    closedAt: pgTimestamp("closed_at"),
    endsAt: pgTimestamp("ends_at"),
    allowMultipleVotes: boolean("allow_multiple_votes").notNull(),
    maxVotesPerMember: integer("max_votes_per_member").notNull(),
    allowAbstain: boolean("allow_abstain").notNull(),
    allowVeto: boolean("allow_veto").notNull(),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("polls_system_id_idx").on(t.systemId),
    check("polls_kind_check", enumCheck(t.kind, POLL_KINDS)),
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
    optionId: varchar("option_id", { length: 255 }),
    voter: jsonb("voter").notNull(),
    isVeto: boolean("is_veto").notNull().default(false),
    votedAt: pgTimestamp("voted_at").notNull(),
    encryptedData: pgBinary("encrypted_data"),
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
    createdByMemberId: varchar("created_by_member_id", { length: 255 }).notNull(),
    targetMemberId: varchar("target_member_id", { length: 255 }).notNull(),
    confirmed: boolean("confirmed").notNull().default(false),
    confirmedAt: pgTimestamp("confirmed_at"),
    encryptedData: pgBinary("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("acknowledgements_system_id_idx").on(t.systemId),
    index("acknowledgements_confirmed_idx").on(t.confirmed),
  ],
);
