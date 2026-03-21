/**
 * Higher-level WebSocket sync fixture for E2E tests.
 *
 * Wraps SyncWsClient with a factory that handles the full setup flow:
 * register an account, fetch the system ID, connect the WebSocket,
 * and authenticate — returning a ready-to-use client in one call.
 *
 * Also re-exports SyncWsClient for tests that need lower-level control.
 */
import { SyncWsClient } from "./ws.fixture.js";

import type { APIRequestContext } from "@playwright/test";
import type { ServerMessage } from "@pluralscape/sync";


export { SyncWsClient } from "./ws.fixture.js";

interface AuthenticatedWsClient {
  /** The connected and authenticated WebSocket client. */
  client: SyncWsClient;
  /** The system ID used during authentication. */
  systemId: string;
  /** The sync session ID returned by the server. */
  syncSessionId: string;
  /** The session token for this account (useful for additional API calls). */
  sessionToken: string;
}

/**
 * Create a WS client that is already connected and authenticated.
 *
 * The caller is responsible for closing the client via `client.close()`.
 *
 * @param sessionToken - Session token from a registered account
 * @param request - Playwright APIRequestContext for fetching the system ID
 */
export async function createAuthenticatedWsClient(
  sessionToken: string,
  request: APIRequestContext,
): Promise<AuthenticatedWsClient> {
  // Fetch the system ID for this account
  const listRes = await request.get("/v1/systems", {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!listRes.ok()) {
    throw new Error(`Failed to list systems: ${String(listRes.status())}`);
  }
  const body = (await listRes.json()) as { items: Array<{ id: string }> };
  const systemId = body.items[0]?.id ?? "";
  if (systemId === "") {
    throw new Error("No system found for account");
  }

  // Connect and authenticate
  const client = new SyncWsClient();
  await client.connect();

  const response: ServerMessage = await client.authenticate(sessionToken, systemId);
  if (response.type !== "AuthenticateResponse") {
    client.close();
    throw new Error(`Authentication failed: ${JSON.stringify(response)}`);
  }

  return {
    client,
    systemId,
    syncSessionId: response.syncSessionId,
    sessionToken,
  };
}

/** Generate a base64url string that decodes to exactly `n` bytes of the given fill value. */
export function base64urlOfLength(n: number, fill = 0): string {
  return Buffer.from(new Uint8Array(n).fill(fill)).toString("base64url");
}

/** Byte length constants for building wire-format test changes. */
export const WIRE_FORMAT = {
  CIPHERTEXT_BYTES: 32,
  NONCE_BYTES: 24,
  SIGNATURE_BYTES: 64,
  PUBLIC_KEY_BYTES: 32,
} as const;

/** Distinct fill byte offsets so each field is distinguishable in tests. */
const FILL_CIPHERTEXT = 1;
const FILL_NONCE = 2;
const FILL_SIGNATURE = 3;
const FILL_PUBLIC_KEY = 4;

/**
 * Build a wire-format change object for submitting via WebSocket.
 * Each field uses a distinct fill byte for easy identification in test assertions.
 */
export function makeTestChange(
  docId: string,
  fillOffset = 0,
): {
  ciphertext: string;
  nonce: string;
  signature: string;
  authorPublicKey: string;
  documentId: string;
} {
  return {
    ciphertext: base64urlOfLength(WIRE_FORMAT.CIPHERTEXT_BYTES, FILL_CIPHERTEXT + fillOffset),
    nonce: base64urlOfLength(WIRE_FORMAT.NONCE_BYTES, FILL_NONCE + fillOffset),
    signature: base64urlOfLength(WIRE_FORMAT.SIGNATURE_BYTES, FILL_SIGNATURE + fillOffset),
    authorPublicKey: base64urlOfLength(WIRE_FORMAT.PUBLIC_KEY_BYTES, FILL_PUBLIC_KEY + fillOffset),
    documentId: docId,
  };
}
