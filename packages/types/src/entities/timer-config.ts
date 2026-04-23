import type { EncryptedBlob } from "../encryption-primitives.js";
import type { SystemId, TimerId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
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

/**
 * Server-visible TimerConfig metadata — raw Drizzle row shape.
 *
 * Hybrid entity: plaintext scheduling columns (`enabled`, `intervalMinutes`,
 * `wakingHoursOnly`, `wakingStart`, `wakingEnd`) are kept in the clear so
 * the server can schedule check-in record generation; the only encrypted
 * payload is `promptText`. Adds a server-only `nextCheckInAt` column that
 * tracks the scheduled next check-in without requiring blob decryption.
 * `archived: false` on the domain flips to a mutable boolean here, with a
 * companion `archivedAt` timestamp.
 */
export type TimerConfigServerMetadata = Omit<TimerConfig, "promptText" | "archived"> & {
  readonly nextCheckInAt: UnixMillis | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * JSON-wire representation of a TimerConfig. Derived from the domain
 * `TimerConfig` type via `Serialize<T>`; branded IDs become plain strings,
 * `UnixMillis` becomes `number`.
 */
export type TimerConfigWire = Serialize<TimerConfig>;
