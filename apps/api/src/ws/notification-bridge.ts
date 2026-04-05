/**
 * Push notifications to authenticated WebSocket connections for an account.
 *
 * Complements SSE-based notification delivery by mirroring payloads to any
 * open WS connections registered for the same account.
 */

interface WsConnection {
  send: (data: string) => void;
  readyState: number;
}

const WS_OPEN = 1;

export class NotificationBridge {
  private readonly connections = new Map<string, Set<WsConnection>>();

  /** Register a WS connection for an account. Returns an unregister function. */
  register(accountId: string, connection: WsConnection): () => void {
    let set = this.connections.get(accountId);
    if (!set) {
      set = new Set();
      this.connections.set(accountId, set);
    }
    set.add(connection);

    return () => {
      const existing = this.connections.get(accountId);
      if (!existing) return;
      existing.delete(connection);
      if (existing.size === 0) {
        this.connections.delete(accountId);
      }
    };
  }

  /** Push a notification to all open WS connections for an account. */
  notify(accountId: string, payload: unknown): void {
    const set = this.connections.get(accountId);
    if (!set) return;

    const message = JSON.stringify({ type: "Notification", payload });

    for (const conn of set) {
      if (conn.readyState === WS_OPEN) {
        conn.send(message);
      } else {
        set.delete(conn);
      }
    }
    if (set.size === 0) {
      this.connections.delete(accountId);
    }
  }
}
