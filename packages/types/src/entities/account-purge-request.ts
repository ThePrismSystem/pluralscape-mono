import type { AccountId, AccountPurgeRequestId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

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
