import type { CheckInRecordId, MemberId, SystemId, TimerId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { Archived, AuditMetadata } from "./utility.js";

/** Configuration for a recurring dissociation check-in timer. */
export interface TimerConfig extends AuditMetadata {
  readonly id: TimerId;
  readonly systemId: SystemId;
  readonly intervalMinutes: number | null;
  readonly wakingHoursOnly: boolean | null;
  readonly wakingStart: string | null;
  readonly wakingEnd: string | null;
  readonly promptText: string;
  readonly enabled: boolean;
  readonly archived: false;
}

/** An archived timer config. */
export type ArchivedTimerConfig = Archived<TimerConfig>;

/** Check-in record status derived from response state. */
export type CheckInRecordStatus = "pending" | "responded" | "dismissed";

/** A record of a scheduled check-in and its response. */
export interface CheckInRecord {
  readonly id: CheckInRecordId;
  readonly timerConfigId: TimerId;
  readonly systemId: SystemId;
  readonly scheduledAt: UnixMillis;
  readonly respondedByMemberId: MemberId | null;
  readonly respondedAt: UnixMillis | null;
  readonly dismissed: boolean;
  readonly archived: false;
  readonly archivedAt: UnixMillis | null;
}

/** An archived check-in record. */
export type ArchivedCheckInRecord = Archived<CheckInRecord>;
