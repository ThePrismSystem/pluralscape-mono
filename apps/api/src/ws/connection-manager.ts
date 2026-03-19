import type { ProfileType, SyncConnectionState } from "./connection-state.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { WSContext } from "hono/ws";

/**
 * Tracks all active WebSocket connections with secondary indexes
 * for efficient lookup by accountId and docId.
 */
export class ConnectionManager {
  private readonly connections = new Map<string, SyncConnectionState>();
  private readonly accountIndex = new Map<string, Set<string>>();
  private readonly docIndex = new Map<string, Set<string>>();
  private unauthCount = 0;

  /** Register a new unauthenticated connection. */
  register(connectionId: string, ws: WSContext, connectedAt: number): SyncConnectionState {
    const state: SyncConnectionState = {
      connectionId,
      ws,
      connectedAt,
      phase: "awaiting-auth",
      auth: null,
      systemId: null,
      profileType: null,
      subscribedDocs: new Set(),
      mutationCount: 0,
      mutationWindowStart: 0,
      readCount: 0,
      readWindowStart: 0,
      rateLimitStrikes: 0,
      authTimeoutHandle: null,
    };
    this.connections.set(connectionId, state);
    this.unauthCount++;
    return state;
  }

  /** Promote a connection to authenticated, updating indexes. */
  authenticate(
    connectionId: string,
    auth: AuthContext,
    systemId: string,
    profileType: ProfileType,
  ): void {
    const state = this.connections.get(connectionId);
    if (!state) return;

    state.phase = "authenticated";
    state.auth = auth;
    state.systemId = systemId;
    state.profileType = profileType;
    this.unauthCount--;

    // Update account index
    let accountSet = this.accountIndex.get(auth.accountId);
    if (!accountSet) {
      accountSet = new Set();
      this.accountIndex.set(auth.accountId, accountSet);
    }
    accountSet.add(connectionId);
  }

  /** Add a document subscription for a connection. */
  addSubscription(connectionId: string, docId: string): void {
    const state = this.connections.get(connectionId);
    if (!state) return;

    state.subscribedDocs.add(docId);

    let docSet = this.docIndex.get(docId);
    if (!docSet) {
      docSet = new Set();
      this.docIndex.set(docId, docSet);
    }
    docSet.add(connectionId);
  }

  /** Remove a document subscription for a connection. */
  removeSubscription(connectionId: string, docId: string): void {
    const state = this.connections.get(connectionId);
    if (!state) return;

    state.subscribedDocs.delete(docId);

    const docSet = this.docIndex.get(docId);
    if (docSet) {
      docSet.delete(connectionId);
      if (docSet.size === 0) {
        this.docIndex.delete(docId);
      }
    }
  }

  /** Remove a connection and clean up all indexes. */
  remove(connectionId: string): void {
    const state = this.connections.get(connectionId);
    if (!state) return;

    // Clear auth timeout
    if (state.authTimeoutHandle !== null) {
      clearTimeout(state.authTimeoutHandle);
      state.authTimeoutHandle = null;
    }

    // Decrement unauth counter if not yet authenticated
    if (state.phase === "awaiting-auth") {
      this.unauthCount--;
    }

    // Remove from account index
    if (state.auth) {
      const accountSet = this.accountIndex.get(state.auth.accountId);
      if (accountSet) {
        accountSet.delete(connectionId);
        if (accountSet.size === 0) {
          this.accountIndex.delete(state.auth.accountId);
        }
      }
    }

    // Remove from all doc indexes
    for (const docId of state.subscribedDocs) {
      const docSet = this.docIndex.get(docId);
      if (docSet) {
        docSet.delete(connectionId);
        if (docSet.size === 0) {
          this.docIndex.delete(docId);
        }
      }
    }

    this.connections.delete(connectionId);
  }

  /** Get a connection by ID. */
  get(connectionId: string): SyncConnectionState | undefined {
    return this.connections.get(connectionId);
  }

  /** Get all connection IDs subscribed to a document. */
  getSubscribers(docId: string): ReadonlySet<string> {
    return this.docIndex.get(docId) ?? EMPTY_SET;
  }

  /** Get all connection IDs for an account. */
  getByAccount(accountId: string): ReadonlySet<string> {
    return this.accountIndex.get(accountId) ?? EMPTY_SET;
  }

  /** Check if a new unauthenticated connection can be accepted. */
  canAcceptUnauthenticated(limit: number): boolean {
    return this.unauthCount < limit;
  }

  /** Get the number of connections for an account. */
  getAccountConnectionCount(accountId: string): number {
    return this.accountIndex.get(accountId)?.size ?? 0;
  }

  /** Close all connections and reset state. */
  closeAll(code: number, reason: string): void {
    for (const state of this.connections.values()) {
      if (state.authTimeoutHandle !== null) {
        clearTimeout(state.authTimeoutHandle);
        state.authTimeoutHandle = null;
      }
      try {
        state.ws.close(code, reason);
      } catch {
        // Connection may already be dead
      }
    }
    this.connections.clear();
    this.accountIndex.clear();
    this.docIndex.clear();
    this.unauthCount = 0;
  }

  /** Number of active connections. */
  get activeCount(): number {
    return this.connections.size;
  }

  /** Number of unauthenticated connections. */
  get unauthenticatedCount(): number {
    return this.unauthCount;
  }
}

const EMPTY_SET: ReadonlySet<string> = new Set();
