import type { Brand, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** A branded subscription ID. */
export type SubscriptionId = Brand<string, "SubscriptionId">;

// ── WebSocket events ──────────────────────────────────────────

/** A fronting session change event. */
export interface FrontingChangedEvent {
  readonly type: "fronting.changed";
  readonly systemId: SystemId;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: UnixMillis;
}

/** A member update event. */
export interface MemberUpdatedEvent {
  readonly type: "member.updated";
  readonly systemId: SystemId;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: UnixMillis;
}

/** A sync state change event. */
export interface SyncStateChangedEvent {
  readonly type: "sync.state-changed";
  readonly systemId: SystemId;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: UnixMillis;
}

/** A new message event. */
export interface MessageReceivedEvent {
  readonly type: "message.received";
  readonly systemId: SystemId;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: UnixMillis;
}

/** A presence heartbeat event. */
export interface PresenceHeartbeatEvent {
  readonly type: "presence.heartbeat";
  readonly systemId: SystemId;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: UnixMillis;
}

/** A connection error event. */
export interface ConnectionErrorEvent {
  readonly type: "connection.error";
  readonly systemId: SystemId;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: UnixMillis;
}

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
  readonly event: string;
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
