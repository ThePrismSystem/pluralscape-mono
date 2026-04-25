import type { EncryptedWire } from "../encrypted-wire.js";
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
 * Keys of `TimerConfig` that are encrypted client-side before the server sees
 * them. The server stores ciphertext in `encryptedData`; the plaintext
 * scheduling columns (`enabled`, `intervalMinutes`, `wakingHoursOnly`,
 * `wakingStart`, `wakingEnd`) are kept in the clear so the server can schedule
 * check-in record generation.
 * Consumed by:
 * - `TimerConfigServerMetadata` (derived via `Omit`)
 * - `TimerConfigEncryptedInput = Pick<TimerConfig, TimerConfigEncryptedFields>`
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextTimerConfig parity)
 */
export type TimerConfigEncryptedFields = "promptText";

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
export type TimerConfigServerMetadata = Omit<
  TimerConfig,
  TimerConfigEncryptedFields | "archived"
> & {
  readonly nextCheckInAt: UnixMillis | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Pre-encryption shape — what `encryptTimerConfigInput` accepts. Single source
 * of truth: derived from `TimerConfig` via `Pick<>` over the encrypted-keys union.
 */
export type TimerConfigEncryptedInput = Pick<TimerConfig, TimerConfigEncryptedFields>;

/**
 * Server-emit shape — what `toTimerConfigResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type TimerConfigResult = EncryptedWire<TimerConfigServerMetadata>;

/**
 * JSON-serialized wire form of `TimerConfigResult`: branded IDs become plain
 * strings; `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type TimerConfigWire = Serialize<TimerConfigResult>;
