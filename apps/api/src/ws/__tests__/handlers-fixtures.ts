/**
 * Shared fixtures for the edge/error-path handlers tests in this directory.
 *
 * Distinct from `__tests__/helpers/ws-handlers-fixtures.ts` (which serves
 * the happy-path tests rooted in `apps/api/src/__tests__/ws/`). These
 * helpers build mock relays, drizzle-style DB chains with controllable
 * key rows, and pre-authenticated connection states for branch coverage
 * in `apps/api/src/ws/handlers.ts`.
 *
 * vi.mock blocks must live per-file (vi.mock is hoisted per-file), so this
 * module exports plain factories only.
 */
import { assertAeadNonce, assertSignPublicKey, assertSignature } from "@pluralscape/crypto";
import { brandId } from "@pluralscape/types";
import { vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { ConnectionManager } from "../connection-manager.js";

import type { AppLogger } from "../../lib/logger.js";
import type { SyncConnectionState } from "../connection-state.js";
import type { AeadNonce, SignPublicKey, Signature } from "@pluralscape/crypto";
import type {
  EncryptedChangeEnvelope,
  EncryptedSnapshotEnvelope,
  PaginatedEnvelopes,
  SyncRelayService,
} from "@pluralscape/sync";
import type { AccountId, SessionId, SyncDocumentId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface BrandedBytes {
  nonce: AeadNonce;
  sig: Signature;
  key: SignPublicKey;
  ct: Uint8Array;
}

export interface MockWsHandle {
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

export interface ConnectionStateHandle {
  state: SyncConnectionState;
  manager: ConnectionManager;
  ws: MockWsHandle;
}

export const TEST_ACCOUNT_ID = brandId<AccountId>("acct_h_test");

export function mockLog(): AppLogger {
  return {
    [APP_LOGGER_BRAND]: true as const,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

export function mockRelay(): {
  relay: SyncRelayService;
  submit: ReturnType<typeof vi.fn>;
  getEnvelopesSince: ReturnType<typeof vi.fn>;
  submitSnapshot: ReturnType<typeof vi.fn>;
  getLatestSnapshot: ReturnType<typeof vi.fn>;
  getManifest: ReturnType<typeof vi.fn>;
} {
  const submit = vi.fn().mockResolvedValue(1);
  const getEnvelopesSince = vi
    .fn()
    .mockResolvedValue({ envelopes: [], hasMore: false } satisfies PaginatedEnvelopes);
  const submitSnapshot = vi.fn().mockResolvedValue(undefined);
  const getLatestSnapshot = vi.fn().mockResolvedValue(null);
  const getManifest = vi.fn().mockResolvedValue({ documents: [] });

  const relay: SyncRelayService = {
    submit,
    getEnvelopesSince,
    submitSnapshot,
    getLatestSnapshot,
    getManifest,
  };
  return { relay, submit, getEnvelopesSince, submitSnapshot, getLatestSnapshot, getManifest };
}

/**
 * Create a mock DB that returns the given public keys for the test account.
 * Uses the drizzle query-builder chain pattern: db.select().from().where() → rows.
 */
export function mockDb(publicKeys: Uint8Array[] = []): PostgresJsDatabase {
  const rows = publicKeys.map((pk) => ({ publicKey: pk }));
  const chain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
  const db = {
    select: vi.fn().mockReturnValue(chain),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };
  return db as never as PostgresJsDatabase;
}

export function brandedBytes(size: number, fill: number): BrandedBytes {
  const nonce = new Uint8Array(24).fill(fill);
  assertAeadNonce(nonce);
  const sig = new Uint8Array(64).fill(fill);
  assertSignature(sig);
  const key = new Uint8Array(32).fill(fill);
  assertSignPublicKey(key);
  const ct = new Uint8Array(size).fill(fill);
  return { nonce, sig, key, ct };
}

export function makeEnvelope(docId: string, seq: number, fill = 0): EncryptedChangeEnvelope {
  const { nonce, sig, key, ct } = brandedBytes(32, fill);
  return {
    ciphertext: ct,
    nonce,
    signature: sig,
    authorPublicKey: key,
    documentId: brandId<SyncDocumentId>(docId),
    seq,
  };
}

export function makeSnapshotEnvelope(
  docId: string,
  snapshotVersion: number,
): EncryptedSnapshotEnvelope {
  const nonce = new Uint8Array(24).fill(2);
  assertAeadNonce(nonce);
  const sig = new Uint8Array(64).fill(3);
  assertSignature(sig);
  const key = new Uint8Array(32).fill(4);
  assertSignPublicKey(key);
  return {
    ciphertext: new Uint8Array(32).fill(1),
    nonce,
    signature: sig,
    authorPublicKey: key,
    documentId: brandId<SyncDocumentId>(docId),
    snapshotVersion,
  };
}

export function makeConnectionState(connectionId: string): ConnectionStateHandle {
  const manager = new ConnectionManager();
  const ws = { close: vi.fn(), send: vi.fn() };
  manager.reserveUnauthSlot();
  manager.register(connectionId, ws as never, Date.now());
  manager.authenticate(
    connectionId,
    {
      authMethod: "session" as const,
      accountId: brandId<AccountId>("acct_h_test"),
      systemId: brandId<SystemId>("sys_h_test"),
      sessionId: brandId<SessionId>("sess_h_test"),
      accountType: "system",
      ownedSystemIds: new Set([brandId<SystemId>("sys_h_test")]),
      auditLogIpTracking: false,
    },
    brandId<SystemId>("sys_h_test"),
    "owner-full",
  );
  const state = manager.get(connectionId);
  if (!state) throw new Error(`State missing for ${connectionId}`);
  return { state, manager, ws };
}

/**
 * Server-side signature verification is unconditional. Tests that do not
 * specifically exercise the verification failure path mock
 * `verifyEnvelopeSignature` to return true so the handler proceeds to the
 * code paths under test.
 */
export async function mockSignatureValid(): Promise<void> {
  const syncModule = await import("@pluralscape/sync");
  vi.spyOn(syncModule, "verifyEnvelopeSignature").mockReturnValue(true);
}
