import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { CheckInRecordId, MemberId, SystemId, TimerId } from "../ids.js";
import type { ServerInternal } from "../server-internal.js";
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

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// CheckInRecord is a hybrid: the domain is plaintext (no encrypted
// fields), but the server row carries an optional `encryptedData` blob
// (mood/note attached to a response) and a server-only `idempotencyKey`
// (webhook dedup, never leaked to clients). Because there are no
// per-variant encrypted fields, the chain is:
//   CheckInRecord → CheckInRecordServerMetadata
//                → CheckInRecordResult → CheckInRecordWire
// (no `EncryptedFields` / `EncryptedInput` aliases).

/**
 * Server-visible CheckInRecord metadata — raw Drizzle row shape.
 *
 * The `archived` literal on the domain (`false`) widens to `boolean` to
 * match the DB column (archive toggles via `Archived<T>` on the domain
 * side; the DB just stores a boolean). `idempotencyKey` is marked
 * `ServerInternal<…>` so `EncryptedWire<T>` strips it from the wire.
 */
export type CheckInRecordServerMetadata = Omit<CheckInRecord, "archived"> & {
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob | null;
  readonly idempotencyKey: ServerInternal<string> | null;
};

export type CheckInRecordResult = EncryptedWire<CheckInRecordServerMetadata>;

export type CheckInRecordWire = Serialize<CheckInRecordResult>;
