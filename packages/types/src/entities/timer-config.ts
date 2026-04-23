import type { SystemId, TimerId } from "../ids.js";
import type { Archived, AuditMetadata } from "../utility.js";

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
