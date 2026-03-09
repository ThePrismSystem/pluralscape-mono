import type { CheckInRecordId, MemberId, SystemId, TimerId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

/** Configuration for a recurring dissociation check-in timer. */
export interface TimerConfig extends AuditMetadata {
  readonly id: TimerId;
  readonly systemId: SystemId;
  readonly intervalMinutes: number;
  readonly wakingHoursOnly: boolean;
  readonly wakingStart: string;
  readonly wakingEnd: string;
  readonly promptText: string;
  readonly enabled: boolean;
}

/** A record of a scheduled check-in and its response. */
export interface CheckInRecord extends AuditMetadata {
  readonly id: CheckInRecordId;
  readonly timerConfigId: TimerId;
  readonly systemId: SystemId;
  readonly scheduledAt: UnixMillis;
  readonly respondedByMemberId: MemberId | null;
  readonly respondedAt: UnixMillis | null;
  readonly dismissed: boolean;
}
