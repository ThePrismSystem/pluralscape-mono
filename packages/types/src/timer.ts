import type { CheckInRecordId, MemberId, SystemId, TimerId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

/** Configuration for a recurring timer or check-in prompt. */
export interface TimerConfig extends AuditMetadata {
  readonly id: TimerId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly intervalSeconds: number;
  readonly enabled: boolean;
  readonly lastTriggeredAt: UnixMillis | null;
}

/** A record of a check-in response. */
export interface CheckInRecord extends AuditMetadata {
  readonly id: CheckInRecordId;
  readonly timerId: TimerId;
  readonly systemId: SystemId;
  readonly respondedByMemberId: MemberId | null;
  readonly response: string | null;
  readonly triggeredAt: UnixMillis;
  readonly respondedAt: UnixMillis | null;
}
