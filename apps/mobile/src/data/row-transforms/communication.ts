import {
  guardedNum,
  guardedStr,
  guardedToMs,
  intToBool,
  parseJsonRequired,
  parseJsonSafe,
  parseStringArray,
  rid,
  strOrNull,
  toMsOrNull,
  wrapArchived,
} from "./primitives.js";

import type { NoteDecrypted } from "@pluralscape/data/transforms/note";
import type {
  AcknowledgementRequest,
  Archived,
  ArchivedAcknowledgementRequest,
  ArchivedBoardMessage,
  ArchivedChannel,
  ArchivedChatMessage,
  ArchivedJournalEntry,
  ArchivedPoll,
  ArchivedWikiPage,
  BoardMessage,
  Channel,
  ChatMessage,
  EntityReference,
  JournalEntry,
  NoteAuthorEntityType,
  Poll,
  WikiPage,
} from "@pluralscape/types";

export function rowToChannel(row: Record<string, unknown>): Channel | ArchivedChannel {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "channels", "updated_at", id);
  const base: Channel = {
    id: guardedStr(row["id"], "channels", "id", id) as Channel["id"],
    systemId: guardedStr(row["system_id"], "channels", "system_id", id) as Channel["systemId"],
    name: guardedStr(row["name"], "channels", "name", id),
    type: guardedStr(row["type"], "channels", "type", id) as Channel["type"],
    parentId: strOrNull(row["parent_id"], "channels", "parent_id", id) as Channel["parentId"],
    sortOrder: guardedNum(row["sort_order"], "channels", "sort_order", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "channels", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToMessage(row: Record<string, unknown>): ChatMessage | ArchivedChatMessage {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  // Mobile SQLite stores edited_at (timestamp), not edit_of (reference)
  const updatedAt =
    toMsOrNull(row["updated_at"], "messages", "updated_at", id) ??
    guardedToMs(row["created_at"], "messages", "created_at", id);
  const base: ChatMessage = {
    id: guardedStr(row["id"], "messages", "id", id) as ChatMessage["id"],
    channelId: guardedStr(
      row["channel_id"],
      "messages",
      "channel_id",
      id,
    ) as ChatMessage["channelId"],
    systemId: guardedStr(row["system_id"], "messages", "system_id", id) as ChatMessage["systemId"],
    senderId: guardedStr(row["sender_id"], "messages", "sender_id", id) as ChatMessage["senderId"],
    content: guardedStr(row["content"], "messages", "content", id),
    attachments: parseStringArray(
      row["attachments"],
      "messages",
      "attachments",
      id,
    ) as ChatMessage["attachments"],
    mentions: parseStringArray(
      row["mentions"],
      "messages",
      "mentions",
      id,
    ) as ChatMessage["mentions"],
    replyToId: strOrNull(
      row["reply_to_id"],
      "messages",
      "reply_to_id",
      id,
    ) as ChatMessage["replyToId"],
    timestamp: guardedToMs(row["timestamp"], "messages", "timestamp", id),
    editedAt: toMsOrNull(row["edited_at"], "messages", "edited_at", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "messages", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToBoardMessage(
  row: Record<string, unknown>,
): BoardMessage | ArchivedBoardMessage {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "board_messages", "updated_at", id);
  const base: BoardMessage = {
    id: guardedStr(row["id"], "board_messages", "id", id) as BoardMessage["id"],
    systemId: guardedStr(
      row["system_id"],
      "board_messages",
      "system_id",
      id,
    ) as BoardMessage["systemId"],
    senderId: guardedStr(
      row["sender_id"],
      "board_messages",
      "sender_id",
      id,
    ) as BoardMessage["senderId"],
    content: guardedStr(row["content"], "board_messages", "content", id),
    pinned: intToBool(row["pinned"]),
    sortOrder: guardedNum(row["sort_order"], "board_messages", "sort_order", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "board_messages", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToPoll(row: Record<string, unknown>): Poll | ArchivedPoll {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "polls", "updated_at", id);
  const base: Poll = {
    id: guardedStr(row["id"], "polls", "id", id) as Poll["id"],
    systemId: guardedStr(row["system_id"], "polls", "system_id", id) as Poll["systemId"],
    createdByMemberId: guardedStr(
      row["created_by_member_id"],
      "polls",
      "created_by_member_id",
      id,
    ) as Poll["createdByMemberId"],
    title: guardedStr(row["title"], "polls", "title", id),
    description: strOrNull(row["description"], "polls", "description", id),
    kind: guardedStr(row["kind"], "polls", "kind", id) as Poll["kind"],
    options: [] as Poll["options"],
    status: guardedStr(row["status"], "polls", "status", id) as Poll["status"],
    closedAt: toMsOrNull(row["closed_at"], "polls", "closed_at", id),
    endsAt: toMsOrNull(row["ends_at"], "polls", "ends_at", id),
    allowMultipleVotes: intToBool(row["allow_multiple_votes"]),
    maxVotesPerMember: guardedNum(row["max_votes_per_member"], "polls", "max_votes_per_member", id),
    allowAbstain: intToBool(row["allow_abstain"]),
    allowVeto: intToBool(row["allow_veto"]),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "polls", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToAcknowledgement(
  row: Record<string, unknown>,
): AcknowledgementRequest | ArchivedAcknowledgementRequest {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "acknowledgements", "updated_at", id);
  const base: AcknowledgementRequest = {
    id: guardedStr(row["id"], "acknowledgements", "id", id) as AcknowledgementRequest["id"],
    systemId: guardedStr(
      row["system_id"],
      "acknowledgements",
      "system_id",
      id,
    ) as AcknowledgementRequest["systemId"],
    createdByMemberId: guardedStr(
      row["created_by_member_id"],
      "acknowledgements",
      "created_by_member_id",
      id,
    ) as AcknowledgementRequest["createdByMemberId"],
    targetMemberId: guardedStr(
      row["target_member_id"],
      "acknowledgements",
      "target_member_id",
      id,
    ) as AcknowledgementRequest["targetMemberId"],
    message: guardedStr(row["message"], "acknowledgements", "message", id),
    confirmed: intToBool(row["confirmed"]),
    confirmedAt: toMsOrNull(row["confirmed_at"], "acknowledgements", "confirmed_at", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "acknowledgements", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

// ── journal document ─────────────────────────────────────────────────────────

export function rowToJournalEntry(
  row: Record<string, unknown>,
): JournalEntry | ArchivedJournalEntry {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "journal_entries", "updated_at", id);
  // Mobile SQLite stores `author` as a plain member-ID string; reconstruct EntityReference.
  const authorRaw = strOrNull(row["author"], "journal_entries", "author", id);
  const author: EntityReference<"member" | "structure-entity"> | null =
    authorRaw !== null ? { entityType: "member", entityId: authorRaw } : null;
  const base: JournalEntry = {
    id: guardedStr(row["id"], "journal_entries", "id", id) as JournalEntry["id"],
    systemId: guardedStr(
      row["system_id"],
      "journal_entries",
      "system_id",
      id,
    ) as JournalEntry["systemId"],
    author,
    frontingSessionId: strOrNull(
      row["fronting_session_id"],
      "journal_entries",
      "fronting_session_id",
      id,
    ) as JournalEntry["frontingSessionId"],
    title: guardedStr(row["title"], "journal_entries", "title", id),
    blocks: parseJsonRequired(
      row["blocks"],
      "journal_entries",
      "blocks",
      id,
    ) as JournalEntry["blocks"],
    tags: parseStringArray(row["tags"], "journal_entries", "tags", id),
    linkedEntities: parseJsonRequired(
      row["linked_entities"],
      "journal_entries",
      "linked_entities",
      id,
    ) as JournalEntry["linkedEntities"],
    frontingSnapshots: parseJsonSafe(
      row["fronting_snapshots"],
      "journal_entries",
      "fronting_snapshots",
      id,
    ) as JournalEntry["frontingSnapshots"],
    archived: false,
    createdAt: guardedToMs(row["created_at"], "journal_entries", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToWikiPage(row: Record<string, unknown>): WikiPage | ArchivedWikiPage {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "wiki_pages", "updated_at", id);
  const base: WikiPage = {
    id: guardedStr(row["id"], "wiki_pages", "id", id) as WikiPage["id"],
    systemId: guardedStr(row["system_id"], "wiki_pages", "system_id", id) as WikiPage["systemId"],
    title: guardedStr(row["title"], "wiki_pages", "title", id),
    slug: guardedStr(row["slug"], "wiki_pages", "slug", id),
    blocks: parseJsonRequired(row["blocks"], "wiki_pages", "blocks", id) as WikiPage["blocks"],
    linkedFromPages: parseStringArray(
      row["linked_from_pages"],
      "wiki_pages",
      "linked_from_pages",
      id,
    ) as WikiPage["linkedFromPages"],
    tags: parseStringArray(row["tags"], "wiki_pages", "tags", id),
    linkedEntities: parseJsonRequired(
      row["linked_entities"],
      "wiki_pages",
      "linked_entities",
      id,
    ) as WikiPage["linkedEntities"],
    archived: false,
    createdAt: guardedToMs(row["created_at"], "wiki_pages", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToNote(row: Record<string, unknown>): NoteDecrypted | Archived<NoteDecrypted> {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "notes", "updated_at", id);
  const base: NoteDecrypted = {
    id: guardedStr(row["id"], "notes", "id", id) as NoteDecrypted["id"],
    systemId: guardedStr(row["system_id"], "notes", "system_id", id) as NoteDecrypted["systemId"],
    authorEntityType: strOrNull(
      row["author_entity_type"],
      "notes",
      "author_entity_type",
      id,
    ) as NoteAuthorEntityType | null,
    authorEntityId: strOrNull(row["author_entity_id"], "notes", "author_entity_id", id),
    title: guardedStr(row["title"], "notes", "title", id),
    content: guardedStr(row["content"], "notes", "content", id),
    backgroundColor: strOrNull(
      row["background_color"],
      "notes",
      "background_color",
      id,
    ) as NoteDecrypted["backgroundColor"],
    archived: false,
    version: 0,
    createdAt: guardedToMs(row["created_at"], "notes", "created_at", id),
    updatedAt,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}
