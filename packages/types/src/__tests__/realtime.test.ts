import { assertType, describe, expectTypeOf, it } from "vitest";

import type { SubscriptionId, SystemId } from "../ids.js";
import type {
  ConnectionErrorEvent,
  FrontingChangedEvent,
  MemberUpdatedEvent,
  MessageReceivedEvent,
  PresenceHeartbeatEvent,
  RealtimeSubscription,
  SSEEvent,
  SyncStateChangedEvent,
  WebSocketConnectionState,
  WebSocketEvent,
  WebSocketEventType,
} from "../realtime.js";
import type { UnixMillis } from "../timestamps.js";

describe("SubscriptionId", () => {
  it("extends string", () => {
    expectTypeOf<SubscriptionId>().toExtend<string>();
  });

  it("is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to SubscriptionId
    assertType<SubscriptionId>("sub_123");
  });
});

describe("WebSocketEvent", () => {
  it("discriminates on type field", () => {
    function handleEvent(event: WebSocketEvent): string {
      switch (event.type) {
        case "fronting.changed":
          expectTypeOf(event).toEqualTypeOf<FrontingChangedEvent>();
          return event.type;
        case "member.updated":
          expectTypeOf(event).toEqualTypeOf<MemberUpdatedEvent>();
          return event.type;
        case "sync.state-changed":
          expectTypeOf(event).toEqualTypeOf<SyncStateChangedEvent>();
          return event.type;
        case "message.received":
          expectTypeOf(event).toEqualTypeOf<MessageReceivedEvent>();
          return event.type;
        case "presence.heartbeat":
          expectTypeOf(event).toEqualTypeOf<PresenceHeartbeatEvent>();
          return event.type;
        case "connection.error":
          expectTypeOf(event).toEqualTypeOf<ConnectionErrorEvent>();
          return event.type;
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleEvent).toBeFunction();
  });

  it("all variants have shared fields", () => {
    expectTypeOf<FrontingChangedEvent["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FrontingChangedEvent["timestamp"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<FrontingChangedEvent["payload"]>().toEqualTypeOf<
      Readonly<Record<string, unknown>>
    >();
  });
});

describe("WebSocketEventType", () => {
  it("accepts valid event types", () => {
    assertType<WebSocketEventType>("fronting.changed");
    assertType<WebSocketEventType>("member.updated");
    assertType<WebSocketEventType>("sync.state-changed");
    assertType<WebSocketEventType>("message.received");
    assertType<WebSocketEventType>("presence.heartbeat");
    assertType<WebSocketEventType>("connection.error");
  });

  it("rejects invalid event types", () => {
    // @ts-expect-error invalid event type
    assertType<WebSocketEventType>("user.login");
  });
});

describe("SSEEvent", () => {
  it("has correct field types", () => {
    expectTypeOf<SSEEvent["event"]>().toEqualTypeOf<WebSocketEventType>();
    expectTypeOf<SSEEvent["data"]>().toBeString();
    expectTypeOf<SSEEvent["id"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SSEEvent["retry"]>().toEqualTypeOf<number | null>();
  });
});

describe("RealtimeSubscription", () => {
  it("has correct field types", () => {
    expectTypeOf<RealtimeSubscription["id"]>().toEqualTypeOf<SubscriptionId>();
    expectTypeOf<RealtimeSubscription["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<RealtimeSubscription["eventTypes"]>().toEqualTypeOf<
      readonly WebSocketEventType[]
    >();
    expectTypeOf<RealtimeSubscription["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("WebSocketConnectionState", () => {
  it("accepts valid states", () => {
    assertType<WebSocketConnectionState>("connecting");
    assertType<WebSocketConnectionState>("connected");
    assertType<WebSocketConnectionState>("disconnected");
    assertType<WebSocketConnectionState>("reconnecting");
  });

  it("rejects invalid states", () => {
    // @ts-expect-error invalid state
    assertType<WebSocketConnectionState>("error");
  });

  it("is exhaustive in a switch", () => {
    function handleState(state: WebSocketConnectionState): string {
      switch (state) {
        case "connecting":
        case "connected":
        case "disconnected":
        case "reconnecting":
          return state;
        default: {
          const _exhaustive: never = state;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleState).toBeFunction();
  });
});
