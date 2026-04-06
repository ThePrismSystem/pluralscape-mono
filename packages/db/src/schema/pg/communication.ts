import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";
import { enumCheck, nullPairCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/db.constants.js";
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

export const channels = pgTable(
  "channels",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    type: varchar("type", { length: ENUM_MAX_LENGTH }).notNull().$type<ServerChannel["type"]>(),
    parentId: varchar("parent_id", { length: ID_MAX_LENGTH }),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
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

// NOTE: The production migration adds PARTITION BY RANGE ("timestamp") which Drizzle
// cannot express. Running drizzle-kit generate for this table requires manual verification.
// See ADR 016 and migration 0002_deep_starbolt.sql for details.
export const messages = pgTable(
  "messages",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).notNull(),
    channelId: varchar("channel_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    replyToId: varchar("reply_to_id", { length: ID_MAX_LENGTH }),
    timestamp: pgTimestamp("timestamp").notNull(),
    editedAt: pgTimestamp("edited_at"),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.timestamp] }),
    index("messages_channel_id_timestamp_idx").on(t.channelId, t.timestamp),
    index("messages_system_archived_idx").on(t.systemId, t.archived),
    index("messages_reply_to_id_idx").on(t.replyToId),
    unique("messages_id_system_id_timestamp_unique").on(t.id, t.systemId, t.timestamp),
    foreignKey({
      columns: [t.channelId, t.systemId],
      foreignColumns: [channels.id, channels.systemId],
    }).onDelete("restrict"),
    versionCheckFor("messages", t.version),
    archivableConsistencyCheckFor("messages", t.archived, t.archivedAt),
  ],
);

export const boardMessages = pgTable(
  "board_messages",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    pinned: boolean("pinned").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
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

export const notes = pgTable(
  "notes",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    authorEntityType: varchar("author_entity_type", { length: ENUM_MAX_LENGTH }),
    authorEntityId: varchar("author_entity_id", { length: ID_MAX_LENGTH }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
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

export const polls = pgTable(
  "polls",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    createdByMemberId: varchar("created_by_member_id", { length: ID_MAX_LENGTH }),
    kind: varchar("kind", { length: ENUM_MAX_LENGTH }).notNull().$type<ServerPoll["kind"]>(),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("open")
      .$type<ServerPoll["status"]>(),
    closedAt: pgTimestamp("closed_at"),
    endsAt: pgTimestamp("ends_at"),
    allowMultipleVotes: boolean("allow_multiple_votes").notNull(),
    maxVotesPerMember: integer("max_votes_per_member").notNull(),
    allowAbstain: boolean("allow_abstain").notNull(),
    allowVeto: boolean("allow_veto").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
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

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    pollId: varchar("poll_id", { length: ID_MAX_LENGTH }).notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    optionId: varchar("option_id", { length: ID_MAX_LENGTH }),
    voter: jsonb("voter").$type<ServerPollVote["voter"]>(),
    isVeto: boolean("is_veto").notNull().default(false),
    votedAt: pgTimestamp("voted_at").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("poll_votes_poll_id_idx").on(t.pollId),
    index("poll_votes_poll_created_idx").on(t.pollId, t.createdAt, t.id),
    index("poll_votes_voter_gin_idx").using("gin", t.voter),
    index("poll_votes_system_archived_idx").on(t.systemId, t.archived),
    foreignKey({
      columns: [t.pollId, t.systemId],
      foreignColumns: [polls.id, polls.systemId],
    }).onDelete("restrict"),
    check("poll_votes_voter_not_null", sql`${t.voter} IS NOT NULL`),
    archivableConsistencyCheckFor("poll_votes", t.archived, t.archivedAt),
    versionCheckFor("poll_votes", t.version),
  ],
);

export const acknowledgements = pgTable(
  "acknowledgements",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    createdByMemberId: varchar("created_by_member_id", { length: ID_MAX_LENGTH }),
    confirmed: boolean("confirmed").notNull().default(false),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
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
