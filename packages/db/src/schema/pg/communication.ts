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

import { brandedId, pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";
import { enumCheck, nullPairCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH } from "../../helpers/db.constants.js";
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
  NoteId,
  PollId,
  PollOptionId,
  PollServerMetadata,
  PollVoteId,
  PollVoteServerMetadata,
  SystemId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const channels = pgTable(
  "channels",
  {
    id: brandedId<ChannelId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    type: varchar("type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<ChannelServerMetadata["type"]>(),
    parentId: brandedId<ChannelId>("parent_id"),
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
    id: brandedId<MessageId>("id").notNull(),
    channelId: brandedId<ChannelId>("channel_id").notNull(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    replyToId: brandedId<MessageId>("reply_to_id"),
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
    id: brandedId<BoardMessageId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
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
    id: brandedId<NoteId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    authorEntityType: varchar("author_entity_type", { length: ENUM_MAX_LENGTH }),
    // Polymorphic: targets member or structure-entity — discriminator lives in
    // `authorEntityType`. Brand-level narrowing happens at the application
    // layer (`brandedId<AnyBrandedId>` intentionally permissive here).
    authorEntityId: brandedId<AnyBrandedId>("author_entity_id"),
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
    id: brandedId<PollId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    createdByMemberId: brandedId<MemberId>("created_by_member_id"),
    kind: varchar("kind", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<PollServerMetadata["kind"]>(),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("open")
      .$type<PollServerMetadata["status"]>(),
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
    id: brandedId<PollVoteId>("id").primaryKey(),
    pollId: brandedId<PollId>("poll_id").notNull(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    optionId: brandedId<PollOptionId>("option_id"),
    voter: jsonb("voter").$type<PollVoteServerMetadata["voter"]>(),
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
    id: brandedId<AcknowledgementId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    createdByMemberId: brandedId<MemberId>("created_by_member_id"),
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
