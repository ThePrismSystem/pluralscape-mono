import type { SubscriptionId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

// ── WebSocket events ──────────────────────────────────────────

/** Base shape for all WebSocket events. */
interface BaseWebSocketEvent<T extends string> {
  readonly type: T;
  readonly systemId: SystemId;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: UnixMillis;
}

/** A fronting session change event. */
export type FrontingChangedEvent = BaseWebSocketEvent<"fronting.changed">;

/** A member update event. */
export type MemberUpdatedEvent = BaseWebSocketEvent<"member.updated">;

/** A sync state change event. */
export type SyncStateChangedEvent = BaseWebSocketEvent<"sync.state-changed">;

/** A new message event. */
export type MessageReceivedEvent = BaseWebSocketEvent<"message.received">;

/** A presence heartbeat event. */
export type PresenceHeartbeatEvent = BaseWebSocketEvent<"presence.heartbeat">;

/** A connection error event. */
export type ConnectionErrorEvent = BaseWebSocketEvent<"connection.error">;

/** Discriminated union of WebSocket events. */
export type WebSocketEvent =
  | FrontingChangedEvent
  | MemberUpdatedEvent
  | SyncStateChangedEvent
  | MessageReceivedEvent
  | PresenceHeartbeatEvent
  | ConnectionErrorEvent;

/** The set of valid WebSocket event type strings. */
export type WebSocketEventType = WebSocketEvent["type"];

// ── SSE events ────────────────────────────────────────────────

/** A server-sent event. */
export interface SSEEvent {
  readonly event: WebSocketEventType;
  readonly data: string;
  readonly id: string | null;
  readonly retry: number | null;
}

// ── Subscriptions ─────────────────────────────────────────────

/** A real-time subscription to a set of event types. */
export interface RealtimeSubscription {
  readonly id: SubscriptionId;
  readonly systemId: SystemId;
  readonly eventTypes: readonly WebSocketEventType[];
  readonly createdAt: UnixMillis;
}

/** Connection state for a WebSocket. */
export type WebSocketConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";
