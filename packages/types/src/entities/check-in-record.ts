import type { EncryptedBlob } from "../encryption-primitives.js";
import type { CheckInRecordId, MemberId, SystemId, TimerId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived } from "../utility.js";

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

/**
 * Server-visible CheckInRecord metadata — raw Drizzle row shape.
 *
 * Hybrid entity: the domain is plaintext (all fields server-visible), but
 * the server row carries two DB-only columns not on the domain:
 *   - `encryptedData` — optional encrypted payload attached to a response
 *     (e.g. mood/note captured with the check-in); nullable because
 *     records start out as scheduled-but-not-responded.
 *   - `idempotencyKey` — server-generated dedup key for webhook-driven
 *     response writes; never leaked to clients.
 *
 * The `archived` literal on the domain (`false`) widens to `boolean` to
 * match the DB column (archive toggles via `Archived<T>` on the domain
 * side; the DB just stores a boolean).
 */
export type CheckInRecordServerMetadata = Omit<CheckInRecord, "archived"> & {
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob | null;
  readonly idempotencyKey: string | null;
};

/**
 * JSON-wire representation of CheckInRecord. Derived from the domain type
 * via `Serialize<T>`; branded IDs become plain strings, `UnixMillis`
 * becomes `number`.
 */
export type CheckInRecordWire = Serialize<CheckInRecord>;
