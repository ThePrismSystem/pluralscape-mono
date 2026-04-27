import {
  guardedStr,
  guardedToMs,
  intToBool,
  rid,
  strOrNull,
  toMsOrNull,
  wrapArchived,
} from "./primitives.js";

import type {
  ArchivedCustomFront,
  ArchivedFrontingComment,
  ArchivedFrontingSession,
  CustomFront,
  FrontingComment,
  FrontingReportWire,
  FrontingSession,
} from "@pluralscape/types";

export function rowToCustomFront(row: Record<string, unknown>): CustomFront | ArchivedCustomFront {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "custom_fronts", "updated_at", id);
  const base: CustomFront = {
    id: guardedStr(row["id"], "custom_fronts", "id", id) as CustomFront["id"],
    systemId: guardedStr(
      row["system_id"],
      "custom_fronts",
      "system_id",
      id,
    ) as CustomFront["systemId"],
    name: guardedStr(row["name"], "custom_fronts", "name", id),
    description: strOrNull(row["description"], "custom_fronts", "description", id),
    color: strOrNull(row["color"], "custom_fronts", "color", id) as CustomFront["color"],
    emoji: strOrNull(row["emoji"], "custom_fronts", "emoji", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "custom_fronts", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToFrontingSession(
  row: Record<string, unknown>,
): FrontingSession | ArchivedFrontingSession {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "fronting_sessions", "updated_at", id);
  const endTime = toMsOrNull(row["end_time"], "fronting_sessions", "end_time", id);
  const baseCommon = {
    id: guardedStr(row["id"], "fronting_sessions", "id", id) as FrontingSession["id"],
    systemId: guardedStr(
      row["system_id"],
      "fronting_sessions",
      "system_id",
      id,
    ) as FrontingSession["systemId"],
    memberId: strOrNull(
      row["member_id"],
      "fronting_sessions",
      "member_id",
      id,
    ) as FrontingSession["memberId"],
    startTime: guardedToMs(row["start_time"], "fronting_sessions", "start_time", id),
    comment: strOrNull(row["comment"], "fronting_sessions", "comment", id),
    customFrontId: strOrNull(
      row["custom_front_id"],
      "fronting_sessions",
      "custom_front_id",
      id,
    ) as FrontingSession["customFrontId"],
    structureEntityId: strOrNull(
      row["structure_entity_id"],
      "fronting_sessions",
      "structure_entity_id",
      id,
    ) as FrontingSession["structureEntityId"],
    positionality: strOrNull(row["positionality"], "fronting_sessions", "positionality", id),
    outtrigger: strOrNull(row["outtrigger"], "fronting_sessions", "outtrigger", id),
    outtriggerSentiment: strOrNull(
      row["outtrigger_sentiment"],
      "fronting_sessions",
      "outtrigger_sentiment",
      id,
    ) as FrontingSession["outtriggerSentiment"],
    archived: false as const,
    createdAt: guardedToMs(row["created_at"], "fronting_sessions", "created_at", id),
    updatedAt,
    version: 0,
  };
  const base: FrontingSession =
    endTime === null ? { ...baseCommon, endTime: null } : { ...baseCommon, endTime };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToFrontingComment(
  row: Record<string, unknown>,
): FrontingComment | ArchivedFrontingComment {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "fronting_comments", "updated_at", id);
  const base: FrontingComment = {
    id: guardedStr(row["id"], "fronting_comments", "id", id) as FrontingComment["id"],
    frontingSessionId: guardedStr(
      row["fronting_session_id"],
      "fronting_comments",
      "fronting_session_id",
      id,
    ) as FrontingComment["frontingSessionId"],
    systemId: guardedStr(
      row["system_id"],
      "fronting_comments",
      "system_id",
      id,
    ) as FrontingComment["systemId"],
    memberId: strOrNull(
      row["member_id"],
      "fronting_comments",
      "member_id",
      id,
    ) as FrontingComment["memberId"],
    customFrontId: strOrNull(
      row["custom_front_id"],
      "fronting_comments",
      "custom_front_id",
      id,
    ) as FrontingComment["customFrontId"],
    structureEntityId: strOrNull(
      row["structure_entity_id"],
      "fronting_comments",
      "structure_entity_id",
      id,
    ) as FrontingComment["structureEntityId"],
    content: guardedStr(row["content"], "fronting_comments", "content", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "fronting_comments", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToFrontingReport(row: Record<string, unknown>): FrontingReportWire {
  // FrontingReport is stored encrypted in SQLite; the row holds the wire shape
  // (encryptedData blob) rather than the decrypted domain fields.
  const id = rid(row);
  return {
    id: guardedStr(row["id"], "fronting_reports", "id", id),
    systemId: guardedStr(row["system_id"], "fronting_reports", "system_id", id),
    encryptedData: guardedStr(row["encrypted_data"], "fronting_reports", "encrypted_data", id),
    format: guardedStr(
      row["format"],
      "fronting_reports",
      "format",
      id,
    ) as FrontingReportWire["format"],
    generatedAt: guardedToMs(row["generated_at"], "fronting_reports", "generated_at", id),
    version: 0,
    archived: false,
    archivedAt: null,
  };
}
