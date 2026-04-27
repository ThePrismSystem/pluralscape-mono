import type { EncryptedBlob } from "../encryption-primitives.js";
import type { AccountId, SessionId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

/** An active session on a device. */
export interface Session {
  readonly id: SessionId;
  readonly accountId: AccountId;
  readonly createdAt: UnixMillis;
  readonly lastActive: UnixMillis | null;
  readonly revoked: boolean;
  readonly expiresAt: UnixMillis | null;
}

/**
 * Device metadata stored inside the session's encryptedData blob.
 * The server never sees this in plaintext — it is T1 encrypted client-side.
 *
 * Class C auxiliary type per ADR-023 — the SoT manifest's
 * `encryptedInput` slot for `Session` points at this type directly
 * (no alias). Parity gate: `DeviceInfoSchema` in
 * `packages/validation/src/session.ts`.
 */
export interface DeviceInfo {
  readonly platform: string;
  readonly appVersion: string;
  readonly deviceName: string;
}

/**
 * Server-visible Session metadata — raw Drizzle row shape.
 *
 * Session is a plaintext entity (the domain type has no client-encrypted
 * field union), but the DB row carries two server-only columns the domain
 * doesn't expose: `tokenHash` (opaque-to-domain hash of the session token
 * the server compares against on every authenticated request) and
 * `encryptedData` (optional T1 blob wrapping `DeviceInfo` — the server
 * only sees the ciphertext).
 */
export interface SessionServerMetadata extends Session {
  readonly tokenHash: string;
  readonly encryptedData: EncryptedBlob | null;
}

/**
 * JSON-wire representation of a Session. Derived from the domain `Session`
 * type via `Serialize<T>`; branded IDs become plain strings and
 * `UnixMillis` becomes `number`.
 */
export type SessionWire = Serialize<Session>;
