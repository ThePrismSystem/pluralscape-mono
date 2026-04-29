import type { AccountId, Brand } from "../ids.js";
import type { ServerInternal } from "../server-internal.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { AuditMetadata } from "../utility.js";

/** Whether an account belongs to a system or a non-system viewer (therapist, friend). */
export type AccountType = "system" | "viewer";

/** Account ID for a phase-1 registration placeholder (not yet committed). */
export type PendingAccountId = Brand<string, "PendingAccountId">;

/** A user account — the top-level authentication entity. */
export interface Account extends AuditMetadata {
  readonly id: AccountId;
  readonly accountType: AccountType;
  readonly emailHash: string;
  readonly emailSalt: string;
  readonly authKeyHash: Uint8Array;
  readonly kdfSalt: string;
  /** Persistent random MasterKey wrapped by the password-derived key (KEK/DEK pattern). */
  readonly encryptedMasterKey: Uint8Array;
}

/**
 * Server-visible Account metadata — raw Drizzle row shape.
 *
 * Account is a plaintext entity (no client-side encryption), so `server`
 * carries the full domain type plus server-only registration + operational
 * columns the domain doesn't expose: the two-phase registration challenge
 * (`challengeNonce` + `challengeExpiresAt`), the server-held encrypted email
 * used for operational mail (ADR 029), and the `auditLogIpTracking` toggle
 * (ADR 028).
 *
 * The four server-only columns are branded `ServerInternal<…>` so
 * `Serialize<AccountServerMetadata>` strips them from the wire envelope —
 * the client never sees server-fill-only registration scaffolding.
 */
export interface AccountServerMetadata extends Account {
  /** Challenge nonce for two-phase registration. Cleared after successful commit. */
  readonly challengeNonce: ServerInternal<Uint8Array> | null;
  /** Expiry time for the challenge nonce (5 minutes after creation). */
  readonly challengeExpiresAt: ServerInternal<UnixMillis> | null;
  /** Server-side encrypted email for operational communication (ADR 029). Null for pre-migration accounts. */
  readonly encryptedEmail: ServerInternal<Uint8Array> | null;
  /** When true, IP address and user-agent are persisted in audit log entries (ADR 028). */
  readonly auditLogIpTracking: ServerInternal<boolean>;
}

/**
 * JSON-wire representation of an Account. Derived from
 * `AccountServerMetadata` via `Serialize<T>`; branded IDs become plain
 * strings, `UnixMillis` becomes `number`, and `Uint8Array` becomes `string`
 * (base64). `ServerInternal<…>`-branded server-only columns are stripped
 * by `Serialize<>` so the client never sees them.
 */
export type AccountWire = Serialize<AccountServerMetadata>;
