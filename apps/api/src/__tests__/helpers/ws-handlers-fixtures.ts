/**
 * Shared fixtures for the ws handlers test suites.
 *
 * Used by the split files under `__tests__/ws/handlers-*.test.ts` (happy
 * path) and the deeper `ws/__tests__/handlers-*.test.ts` (error/edge).
 * vi.mock blocks must live per-file (vi.mock is hoisted per-file), so this
 * module only exports plain values, factories, and type guards.
 */
import { brandId } from "@pluralscape/types";
import { vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { ConnectionManager } from "../../ws/connection-manager.js";

import { nonce, pubkey, sig } from "./crypto-test-fixtures.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AppLogger } from "../../lib/logger.js";
import type { SyncConnectionState } from "../../ws/connection-state.js";
import type { SubmitChangeResult } from "../../ws/handlers.js";
import type {
  EncryptedChangeEnvelope,
  EncryptedSnapshotEnvelope,
  SyncError,
} from "@pluralscape/sync";
import type { AccountId, SessionId, SyncDocumentId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

let changeCounter = 0;

/** Build a minimal mock change envelope (without seq) using deterministic fills. */
export function mockChangeWithoutSeq(id: SyncDocumentId): Omit<EncryptedChangeEnvelope, "seq"> {
  const fill = ++changeCounter;
  return {
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: nonce(fill),
    signature: sig(fill),
    authorPublicKey: pubkey(10),
    documentId: id,
  };
}

/** Build a minimal mock snapshot envelope at a given version. */
export function mockSnapshot(id: SyncDocumentId, version: number): EncryptedSnapshotEnvelope {
  return {
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: nonce(4),
    signature: sig(7),
    authorPublicKey: pubkey(10),
    documentId: id,
    snapshotVersion: version,
  };
}

/** Mock WebSocket double with vi.fn() send/close stubs. */
export function mockWs(): { close: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  return { close: vi.fn(), send: vi.fn() };
}

/** Mock AuthContext with random AccountId by default. */
export function mockAuth(accountId = brandId<AccountId>(crypto.randomUUID())): AuthContext {
  return {
    authMethod: "session" as const,
    accountId,
    systemId: brandId<SystemId>(crypto.randomUUID()),
    sessionId: brandId<SessionId>(crypto.randomUUID()),
    accountType: "system",
    ownedSystemIds: new Set(),
    auditLogIpTracking: false,
  };
}

/** Register and authenticate a connection with the manager, returning the state. */
export function createAuthenticatedState(
  manager: ConnectionManager,
  connId: string,
  auth: AuthContext,
  systemId: SystemId,
): SyncConnectionState {
  manager.reserveUnauthSlot();
  manager.register(connId, mockWs() as never, Date.now());
  manager.authenticate(connId, auth, systemId, "owner-full");
  const state = manager.get(connId);
  if (!state) {
    throw new Error(`Connection ${connId} not found after registration`);
  }
  return state;
}

/** Brand-respecting AppLogger double. */
export function mockLog(): AppLogger {
  return {
    [APP_LOGGER_BRAND]: true as const,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

/** Type guard: returns true if the result is a SubmitChangeResult (not SyncError). */
export function isSubmitChangeResult(
  result: SubmitChangeResult | SyncError,
): result is SubmitChangeResult {
  return result.type === "SubmitChangeResult";
}

/**
 * Create a mock PostgresJsDatabase that satisfies verifyKeyOwnership.
 * Returns the test authorPublicKey so the ownership check passes.
 */
export function mockDb(authorPublicKey: Uint8Array = pubkey(10)): PostgresJsDatabase {
  const whereResult = Promise.resolve([{ publicKey: authorPublicKey }]);
  const whereFn = vi.fn().mockReturnValue(whereResult);
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });
  const db = {
    select: selectFn,
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };
  return db as never as PostgresJsDatabase;
}

/** Account ID used across the happy-path handlers tests. */
export const TEST_ACCOUNT_ID = brandId<AccountId>(crypto.randomUUID());
