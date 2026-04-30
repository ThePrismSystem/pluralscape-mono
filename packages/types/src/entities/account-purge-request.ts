import type { AccountId, AccountPurgeRequestId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

/** Status of an account purge request. */
export type AccountPurgeStatus = "pending" | "confirmed" | "processing" | "completed" | "cancelled";

/** Request to purge an entire account and all associated data. */
export interface AccountPurgeRequest {
  readonly id: AccountPurgeRequestId;
  readonly accountId: AccountId;
  readonly status: AccountPurgeStatus;
  readonly confirmationPhrase: string;
  readonly requestedAt: UnixMillis;
  readonly confirmedAt: UnixMillis | null;
  readonly scheduledPurgeAt: UnixMillis;
  readonly completedAt: UnixMillis | null;
  readonly cancelledAt: UnixMillis | null;
}

/**
 * Server-visible AccountPurgeRequest metadata — raw Drizzle row shape.
 *
 * The DB row matches the domain `AccountPurgeRequest` type exactly.
 * Purge-request rows carry no encrypted or server-only fields; they
 * are plaintext operational metadata the server owns end-to-end.
 */
export type AccountPurgeRequestServerMetadata = AccountPurgeRequest;

/**
 * JSON-wire representation of an AccountPurgeRequest. Derived from
 * `AccountPurgeRequestServerMetadata` via `Serialize<T>`; branded IDs become
 * plain strings and `UnixMillis` becomes `number`.
 */
export type AccountPurgeRequestWire = Serialize<AccountPurgeRequestServerMetadata>;
