import { SlidingWindowCounter } from "./sliding-window-counter.js";
import {
  WS_CLOSE_GOING_AWAY,
  WS_MAX_SUBSCRIPTIONS_PER_CONNECTION,
  WS_SHUTDOWN_DRAIN_POLL_MS,
} from "./ws.constants.js";
import { formatError } from "./ws.utils.js";

import type {
  AuthenticatedState,
  AwaitingAuthState,
  ProfileType,
  SyncConnectionState,
} from "./connection-state.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { AppLogger } from "../lib/logger.js";
import type { SystemId } from "@pluralscape/types";
import type { WSContext } from "hono/ws";

/**
 * Tracks all active WebSocket connections with secondary indexes
 * for efficient lookup by accountId and docId.
 */
export class ConnectionManager {
  private readonly connections = new Map<string, SyncConnectionState>();
  private readonly accountIndex = new Map<string, Set<string>>();
  private readonly docIndex = new Map<string, Set<string>>();
  private readonly ipUnauthCount = new Map<string, number>();
  private unauthCount = 0;
  private shuttingDown = false;

  /** Reserve a slot for an unauthenticated connection (before onOpen fires). */
  reserveUnauthSlot(ip?: string): void {
    this.unauthCount++;
    if (ip) {
      this.ipUnauthCount.set(ip, (this.ipUnauthCount.get(ip) ?? 0) + 1);
    }
  }

  /** Release a reserved unauthenticated slot (if onOpen never fires). */
  releaseUnauthSlot(ip?: string): void {
    this.unauthCount = Math.max(0, this.unauthCount - 1);
    this.releaseIpSlot(ip);
  }

  /** Check if a new unauthenticated connection from the given IP can be accepted. */
  canAcceptFromIp(ip: string, limit: number): boolean {
    return (this.ipUnauthCount.get(ip) ?? 0) < limit;
  }

  /** Decrement the per-IP unauthenticated counter (no-op if ip is undefined). */
  private releaseIpSlot(ip: string | undefined): void {
    if (!ip) return;
    const current = this.ipUnauthCount.get(ip) ?? 0;
    if (current <= 1) {
      this.ipUnauthCount.delete(ip);
    } else {
      this.ipUnauthCount.set(ip, current - 1);
    }
  }

  /** Register a new unauthenticated connection. Does not increment unauthCount (caller pre-reserves). */
  register(
    connectionId: string,
    ws: WSContext,
    connectedAt: number,
    clientIp?: string,
  ): AwaitingAuthState {
    const state: AwaitingAuthState = {
      connectionId,
      ws,
      connectedAt,
      clientIp,
      phase: "awaiting-auth",
      auth: null,
      systemId: null,
      profileType: null,
      subscribedDocs: new Set(),
      mutationWindow: new SlidingWindowCounter(),
      readWindow: new SlidingWindowCounter(),
      rateLimitStrikes: 0,
      authTimeoutHandle: null,
    };
    this.connections.set(connectionId, state);
    return state;
  }

  /** Promote a connection to authenticated, updating indexes. Returns false if connection not found. */
  authenticate(
    connectionId: string,
    auth: AuthContext,
    systemId: SystemId,
    profileType: ProfileType,
  ): boolean {
    const state = this.connections.get(connectionId);
    if (!state) return false;

    // Only decrement unauthCount when transitioning from awaiting-auth
    if (state.phase === "awaiting-auth") {
      // Clear auth timeout inside authenticate
      if (state.authTimeoutHandle !== null) {
        clearTimeout(state.authTimeoutHandle);
      }

      // Create a new AuthenticatedState (can't mutate readonly discriminant)
      const authenticated: AuthenticatedState = {
        connectionId: state.connectionId,
        ws: state.ws,
        connectedAt: state.connectedAt,
        clientIp: state.clientIp,
        phase: "authenticated",
        auth,
        systemId,
        profileType,
        subscribedDocs: state.subscribedDocs,
        mutationWindow: state.mutationWindow,
        readWindow: state.readWindow,
        rateLimitStrikes: state.rateLimitStrikes,
        authTimeoutHandle: null,
      };
      this.connections.set(connectionId, authenticated);
      this.unauthCount = Math.max(0, this.unauthCount - 1);
      this.releaseIpSlot(state.clientIp);

      // Update account index
      let accountSet = this.accountIndex.get(auth.accountId);
      if (!accountSet) {
        accountSet = new Set();
        this.accountIndex.set(auth.accountId, accountSet);
      }
      accountSet.add(connectionId);

      return true;
    }

    return false;
  }

  /** Add a document subscription for a connection. Returns false if at subscription cap. */
  addSubscription(connectionId: string, docId: string): boolean {
    const state = this.connections.get(connectionId);
    if (!state) return false;

    if (
      !state.subscribedDocs.has(docId) &&
      state.subscribedDocs.size >= WS_MAX_SUBSCRIPTIONS_PER_CONNECTION
    ) {
      return false;
    }

    state.subscribedDocs.add(docId);

    let docSet = this.docIndex.get(docId);
    if (!docSet) {
      docSet = new Set();
      this.docIndex.set(docId, docSet);
    }
    docSet.add(connectionId);
    return true;
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

  /** Remove all subscriptions for a document across all connections. */
  removeSubscriptionsForDoc(docId: string): void {
    const docSet = this.docIndex.get(docId);
    if (!docSet) return;

    for (const connectionId of docSet) {
      const state = this.connections.get(connectionId);
      if (state) {
        state.subscribedDocs.delete(docId);
      }
    }
    this.docIndex.delete(docId);
  }

  /** Remove a connection and clean up all indexes. */
  remove(connectionId: string): void {
    const state = this.connections.get(connectionId);
    if (!state) return;

    // Clear auth timeout
    if (state.authTimeoutHandle !== null) {
      clearTimeout(state.authTimeoutHandle);
    }

    // Decrement unauth counter if not yet authenticated
    if (state.phase === "awaiting-auth") {
      this.unauthCount = Math.max(0, this.unauthCount - 1);
      this.releaseIpSlot(state.clientIp);
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
    return !this.shuttingDown && this.unauthCount < limit;
  }

  /** Get the number of connections for an account. */
  getAccountConnectionCount(accountId: string): number {
    return this.accountIndex.get(accountId)?.size ?? 0;
  }

  /** Send close frames to all tracked connections. Does not clear maps. */
  private _closeConnections(code: number, reason: string, log?: Pick<AppLogger, "debug">): void {
    for (const state of this.connections.values()) {
      if (state.authTimeoutHandle !== null) {
        clearTimeout(state.authTimeoutHandle);
      }
      try {
        state.ws.close(code, reason);
      } catch (err) {
        log?.debug("Failed to close WebSocket", {
          connectionId: state.connectionId,
          error: formatError(err),
        });
      }
    }
  }

  /** Close all connections and reset state. */
  closeAll(code: number, reason: string, log?: Pick<AppLogger, "debug">): void {
    this._closeConnections(code, reason, log);
    this.connections.clear();
    this.accountIndex.clear();
    this.docIndex.clear();
    this.ipUnauthCount.clear();
    this.unauthCount = 0;
  }

  /** Whether the manager is in the process of shutting down. */
  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /**
   * Graceful shutdown sequence:
   * 1. Set accepting flag to false (reject new connections)
   * 2. Send close frame to all connections
   * 3. Wait for connections to drain (with timeout)
   * 4. Force-close remaining connections
   */
  async gracefulShutdown(timeoutMs: number, log?: Pick<AppLogger, "debug">): Promise<void> {
    // Phase 1: Reject new connections
    this.shuttingDown = true;

    if (this.connections.size === 0) {
      return;
    }

    // Phase 2: Send close frame to all connections
    this._closeConnections(WS_CLOSE_GOING_AWAY, "Server shutting down", log);

    // Phase 3: Wait for connections to drain or timeout
    const drainStart = Date.now();
    while (this.connections.size > 0 && Date.now() - drainStart < timeoutMs) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, WS_SHUTDOWN_DRAIN_POLL_MS);
      });
    }

    // Phase 4: Force-close remaining connections
    if (this.connections.size > 0) {
      log?.debug("Force-closing remaining connections after graceful shutdown timeout", {
        remaining: this.connections.size,
      });
      this._closeConnections(WS_CLOSE_GOING_AWAY, "Server shutting down", log);
    }
    this.connections.clear();
    this.accountIndex.clear();
    this.docIndex.clear();
    this.ipUnauthCount.clear();
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
