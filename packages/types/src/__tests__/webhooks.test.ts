import { assertType, describe, expectTypeOf, it } from "vitest";

import type { SystemId, WebhookId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";
import type {
  EncryptedWebhookPayload,
  PlaintextWebhookPayload,
  WebhookConfig,
  WebhookDelivery,
  WebhookDeliveryId,
  WebhookDeliveryPayload,
  WebhookEventType,
} from "../webhooks.js";

describe("WebhookDeliveryId", () => {
  it("extends string", () => {
    expectTypeOf<WebhookDeliveryId>().toExtend<string>();
  });

  it("is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to WebhookDeliveryId
    assertType<WebhookDeliveryId>("wd_123");
  });
});

describe("WebhookEventType", () => {
  it("accepts valid event types", () => {
    assertType<WebhookEventType>("member.created");
    assertType<WebhookEventType>("fronting.started");
    assertType<WebhookEventType>("switch.recorded");
  });

  it("rejects invalid event types", () => {
    // @ts-expect-error invalid event type
    assertType<WebhookEventType>("system.deleted");
  });

  it("is exhaustive in a switch", () => {
    function handleType(type: WebhookEventType): string {
      switch (type) {
        case "member.created":
        case "member.updated":
        case "member.archived":
        case "fronting.started":
        case "fronting.ended":
        case "switch.recorded":
        case "group.created":
        case "group.updated":
          return type;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleType).toBeFunction();
  });
});

describe("WebhookConfig", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<WebhookConfig>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<WebhookConfig["id"]>().toEqualTypeOf<WebhookId>();
    expectTypeOf<WebhookConfig["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<WebhookConfig["url"]>().toBeString();
    expectTypeOf<WebhookConfig["secret"]>().toBeString();
    expectTypeOf<WebhookConfig["eventTypes"]>().toEqualTypeOf<readonly WebhookEventType[]>();
    expectTypeOf<WebhookConfig["enabled"]>().toEqualTypeOf<boolean>();
  });
});

describe("WebhookDeliveryPayload", () => {
  it("discriminates on encrypted field", () => {
    function handlePayload(payload: WebhookDeliveryPayload): string {
      if (payload.encrypted) {
        expectTypeOf(payload).toEqualTypeOf<EncryptedWebhookPayload>();
        return payload.ciphertext;
      }
      expectTypeOf(payload).toEqualTypeOf<PlaintextWebhookPayload>();
      return JSON.stringify(payload.body);
    }
    expectTypeOf(handlePayload).toBeFunction();
  });
});

describe("WebhookDelivery", () => {
  it("has correct field types", () => {
    expectTypeOf<WebhookDelivery["id"]>().toEqualTypeOf<WebhookDeliveryId>();
    expectTypeOf<WebhookDelivery["webhookId"]>().toEqualTypeOf<WebhookId>();
    expectTypeOf<WebhookDelivery["eventType"]>().toEqualTypeOf<WebhookEventType>();
    expectTypeOf<WebhookDelivery["payload"]>().toEqualTypeOf<WebhookDeliveryPayload>();
    expectTypeOf<WebhookDelivery["statusCode"]>().toEqualTypeOf<number | null>();
    expectTypeOf<WebhookDelivery["deliveredAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<WebhookDelivery["success"]>().toEqualTypeOf<boolean>();
  });
});
