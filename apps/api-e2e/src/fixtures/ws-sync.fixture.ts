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
export { createSyncCryptoContext, makeSignedChange, makeSignedSnapshot } from "./crypto.fixture.js";
export type { WireChangePayload, WireSnapshotPayload, SyncCryptoContext } from "./crypto.fixture.js";

interface AuthenticatedWsClient {
  /** The connected and authenticated WebSocket client. */
  ws: SyncWsClient;
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
 * The caller is responsible for closing the client via `ws.close()`.
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

  // Connect and authenticate — close on any failure to prevent WS leak
  const client = new SyncWsClient();
  try {
    await client.connect();

    const response: ServerMessage = await client.authenticate(sessionToken, systemId);
    if (response.type !== "AuthenticateResponse") {
      throw new Error(`Authentication failed: ${JSON.stringify(response)}`);
    }

    return {
      ws: client,
      systemId,
      syncSessionId: response.syncSessionId,
      sessionToken,
    };
  } catch (err) {
    client.close();
    throw err;
  }
}

