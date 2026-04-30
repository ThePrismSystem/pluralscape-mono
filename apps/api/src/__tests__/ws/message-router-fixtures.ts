/**
 * Shared fixtures for split message-router tests.
 *
 * Each split file owns its own `sent` array (module-local), so helpers that
 * need it accept it as a parameter. vi.mock blocks must live per-file
 * (vi.mock is hoisted per-file), so this module exports plain factories only.
 */
import { SYNC_PROTOCOL_VERSION } from "@pluralscape/sync";
import { brandId } from "@pluralscape/types";
import { vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { ConnectionManager } from "../../ws/connection-manager.js";
import { createRouterContext } from "../../ws/message-router.js";

import type { AppLogger } from "../../lib/logger.js";
import type { SyncConnectionState } from "../../ws/connection-state.js";
import type { RouterContext } from "../../ws/message-router.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

export interface MockWsHandle {
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

/**
 * Build a mock WebSocket whose `send` pushes onto the provided `sent` buffer.
 * This lets each split file capture outgoing messages locally without
 * relying on a module-level shared array.
 */
export function makeMockWs(sent: string[]): MockWsHandle {
  return {
    close: vi.fn(),
    send: vi.fn((data: string) => {
      sent.push(data);
    }),
  };
}

export function makeMockLog(): AppLogger {
  return {
    [APP_LOGGER_BRAND]: true as const,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

export function lastResponse(sent: string[]): Record<string, unknown> {
  const last = sent[sent.length - 1];
  if (!last) throw new Error("No response sent");
  return JSON.parse(last) as Record<string, unknown>;
}

/** Generate a base64url string that decodes to exactly `n` bytes. */
export function base64urlOfLength(n: number, fill = 0): string {
  return Buffer.from(new Uint8Array(n).fill(fill)).toString("base64url");
}

export function makeChangePayload(docId: string): Record<string, string> {
  return {
    ciphertext: base64urlOfLength(32, 1),
    nonce: base64urlOfLength(24, 2), // AEAD_NONCE_BYTES = 24
    signature: base64urlOfLength(64, 3), // SIGN_BYTES = 64
    authorPublicKey: base64urlOfLength(32, 4), // SIGN_PUBLIC_KEY_BYTES = 32
    documentId: docId,
  };
}

/** Build a snapshot envelope JSON payload for SubmitSnapshotRequest tests. */
export function makeSnapshotPayload(
  docId: string,
  snapshotVersion: number,
  fillBase = 1,
): Record<string, string | number> {
  return {
    ciphertext: base64urlOfLength(32, fillBase),
    nonce: base64urlOfLength(24, fillBase + 1),
    signature: base64urlOfLength(64, fillBase + 2),
    authorPublicKey: base64urlOfLength(32, fillBase + 3),
    documentId: docId,
    snapshotVersion,
  };
}

/** Pre-canned AuthenticateRequest body (string-encoded) for `sys_test`. */
export function authRequest(): string {
  return JSON.stringify({
    type: "AuthenticateRequest",
    correlationId: null,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sessionToken: "a".repeat(64),
    systemId: "sys_test",
    profileType: "owner-full",
  });
}

/**
 * Build a `RouterContext` with a relay where every method is a `vi.fn()`.
 * Pass an `overrides` partial to make specific methods throw or return
 * canned values. The returned ctx shares the provided `manager` and has
 * an empty `documentOwnership` map.
 */
export function makeBrokenRelayContext(
  manager: ConnectionManager,
  overrides: Partial<{
    submit: () => unknown;
    submitSnapshot: () => unknown;
    getEnvelopesSince: () => unknown;
    getLatestSnapshot: () => unknown;
    getManifest: () => unknown;
  }> = {},
): RouterContext {
  const relay = {
    submit: vi.fn(overrides.submit),
    submitSnapshot: vi.fn(overrides.submitSnapshot),
    getEnvelopesSince: vi.fn(overrides.getEnvelopesSince),
    getLatestSnapshot: vi.fn(overrides.getLatestSnapshot),
    getManifest: vi.fn(overrides.getManifest),
  };
  return {
    relay: relay as never,
    documentOwnership: new Map<string, SystemId>(),
    manager,
    pubsub: null,
  };
}

/** Auth context for `sys_test` used across nearly every router test. */
export const SYS_TEST_AUTH = {
  authMethod: "session" as const,
  accountId: brandId<AccountId>("acct_test"),
  systemId: brandId<SystemId>("sys_test"),
  sessionId: brandId<SessionId>("sess_test"),
  accountType: "system" as const,
  ownedSystemIds: new Set([brandId<SystemId>("sys_test")]),
  auditLogIpTracking: false,
};

/**
 * Register and authenticate a connection on the given manager as `sys_test`.
 * Returns the resulting state and the (already-attached) ws handle so callers
 * can observe outgoing messages or override `ws.send`.
 */
export function addAuthedConnection(
  manager: ConnectionManager,
  connectionId: string,
  systemId: SystemId = brandId<SystemId>("sys_test"),
): { state: SyncConnectionState; ws: MockWsHandle; sent: string[] } {
  const sent: string[] = [];
  const ws = makeMockWs(sent);
  manager.reserveUnauthSlot();
  manager.register(connectionId, ws as never, Date.now());
  manager.authenticate(
    connectionId,
    {
      ...SYS_TEST_AUTH,
      systemId,
      ownedSystemIds: new Set([systemId]),
    },
    systemId,
    "owner-full",
  );
  const state = manager.get(connectionId);
  if (!state) throw new Error(`State missing for ${connectionId}`);
  return { state, ws, sent };
}

/**
 * Build a manager with a connection authed as `sys_test` whose `ws.send`
 * throws a "broken pipe" error. Used to verify the router does not crash
 * when the underlying ws fails mid-response.
 */
export function makeBrokenWsConnection(connectionId: string): {
  manager: ConnectionManager;
  state: SyncConnectionState;
  ctx: RouterContext;
} {
  const manager = new ConnectionManager();
  const { state, ws } = addAuthedConnection(manager, connectionId);
  ws.send.mockImplementation(() => {
    throw new Error("broken pipe");
  });
  const ctx = createRouterContext(1000, manager);
  return { manager, state, ctx };
}
