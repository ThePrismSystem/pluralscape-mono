import {
  guardedStr,
  guardedToMs,
  intToBool,
  numOrNull,
  parseJsonRequired,
  rid,
  strOrNull,
  toMsOrNull,
  wrapArchived,
} from "./primitives.js";

import type {
  Archived,
  ArchivedCheckInRecord,
  ArchivedTimerConfig,
  CheckInRecord,
  LifecycleEvent,
  TimerConfig,
} from "@pluralscape/types";

export function rowToTimer(row: Record<string, unknown>): TimerConfig | ArchivedTimerConfig {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "timer_configs", "updated_at", id);
  const wakingHoursOnly =
    row["waking_hours_only"] === null || row["waking_hours_only"] === undefined
      ? null
      : intToBool(row["waking_hours_only"]);
  const base: TimerConfig = {
    id: guardedStr(row["id"], "timer_configs", "id", id) as TimerConfig["id"],
    systemId: guardedStr(
      row["system_id"],
      "timer_configs",
      "system_id",
      id,
    ) as TimerConfig["systemId"],
    intervalMinutes: numOrNull(row["interval_minutes"], "timer_configs", "interval_minutes", id),
    wakingHoursOnly,
    wakingStart: strOrNull(row["waking_start"], "timer_configs", "waking_start", id),
    wakingEnd: strOrNull(row["waking_end"], "timer_configs", "waking_end", id),
    promptText: guardedStr(row["prompt_text"], "timer_configs", "prompt_text", id),
    enabled: intToBool(row["enabled"]),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "timer_configs", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

/**
 * Type assertion: the CRDT materializer validated the LifecycleEvent payload
 * shape at write time, so the assembled object is a valid discriminated union
 * member. TS cannot verify this statically across a generic payload spread.
 */
function assertLifecycleEvent(v: unknown): asserts v is LifecycleEvent {
  // Validated by CRDT materializer at write time — runtime check elided
  void v;
}

export function rowToLifecycleEvent(
  row: Record<string, unknown>,
): LifecycleEvent | Archived<LifecycleEvent> {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const eventType = guardedStr(
    row["event_type"],
    "lifecycle_events",
    "event_type",
    id,
  ) as LifecycleEvent["eventType"];
  const payload = parseJsonRequired(row["payload"], "lifecycle_events", "payload", id) as Record<
    string,
    unknown
  >;
  const recordedAt = guardedToMs(row["recorded_at"], "lifecycle_events", "recorded_at", id);
  const base = {
    id: guardedStr(row["id"], "lifecycle_events", "id", id) as LifecycleEvent["id"],
    systemId: guardedStr(
      row["system_id"],
      "lifecycle_events",
      "system_id",
      id,
    ) as LifecycleEvent["systemId"],
    occurredAt: guardedToMs(row["occurred_at"], "lifecycle_events", "occurred_at", id),
    recordedAt,
    notes: strOrNull(row["notes"], "lifecycle_events", "notes", id),
  };
  const assembled = { ...base, eventType, ...payload };
  assertLifecycleEvent(assembled);
  if (archived) {
    return { ...assembled, archived: true as const, archivedAt: recordedAt };
  }
  return { ...assembled, archived: false as const };
}

export function rowToCheckInRecord(
  row: Record<string, unknown>,
): CheckInRecord | ArchivedCheckInRecord {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const archivedAt = toMsOrNull(row["archived_at"], "check_in_records", "archived_at", id);
  const base: CheckInRecord = {
    id: guardedStr(row["id"], "check_in_records", "id", id) as CheckInRecord["id"],
    timerConfigId: guardedStr(
      row["timer_config_id"],
      "check_in_records",
      "timer_config_id",
      id,
    ) as CheckInRecord["timerConfigId"],
    systemId: guardedStr(
      row["system_id"],
      "check_in_records",
      "system_id",
      id,
    ) as CheckInRecord["systemId"],
    scheduledAt: guardedToMs(row["scheduled_at"], "check_in_records", "scheduled_at", id),
    respondedByMemberId: strOrNull(
      row["responded_by_member_id"],
      "check_in_records",
      "responded_by_member_id",
      id,
    ) as CheckInRecord["respondedByMemberId"],
    respondedAt: toMsOrNull(row["responded_at"], "check_in_records", "responded_at", id),
    dismissed: intToBool(row["dismissed"]),
    archived: false,
    archivedAt,
  };
  if (archived) {
    const updatedAt = guardedToMs(row["updated_at"], "check_in_records", "updated_at", id);
    return wrapArchived(base, archivedAt ?? updatedAt);
  }
  return base;
}
