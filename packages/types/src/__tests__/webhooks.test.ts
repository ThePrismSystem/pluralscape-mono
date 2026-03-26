import { assertType, describe, expectTypeOf, it } from "vitest";

import type { EncryptedString } from "../encryption.js";
import type { ApiKeyId, SystemId, WebhookDeliveryId, WebhookId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";
import type {
  ArchivedWebhookConfig,
  ArchivedWebhookDelivery,
  WebhookConfig,
  WebhookDelivery,
  WebhookDeliveryStatus,
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
        case "group.created":
        case "group.updated":
        case "lifecycle.event-recorded":
        case "custom-front.changed":
        case "channel.created":
        case "channel.updated":
        case "channel.archived":
        case "channel.restored":
        case "channel.deleted":
        case "message.created":
        case "message.updated":
        case "message.archived":
        case "message.restored":
        case "message.deleted":
        case "board-message.created":
        case "board-message.updated":
        case "board-message.pinned":
        case "board-message.unpinned":
        case "board-message.reordered":
        case "board-message.archived":
        case "board-message.restored":
        case "board-message.deleted":
        case "note.created":
        case "note.updated":
        case "note.archived":
        case "note.restored":
        case "note.deleted":
        case "poll.created":
        case "poll.updated":
        case "poll.closed":
        case "poll.archived":
        case "poll.restored":
        case "poll.deleted":
        case "poll-vote.cast":
        case "poll-vote.vetoed":
        case "acknowledgement.created":
        case "acknowledgement.confirmed":
        case "acknowledgement.archived":
        case "acknowledgement.restored":
        case "acknowledgement.deleted":
        case "bucket.created":
        case "bucket.updated":
        case "bucket.archived":
        case "bucket.restored":
        case "bucket.deleted":
        case "bucket-content-tag.tagged":
        case "bucket-content-tag.untagged":
        case "field-bucket-visibility.set":
        case "field-bucket-visibility.removed":
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
    expectTypeOf<WebhookConfig["secret"]>().toEqualTypeOf<EncryptedString>();
    expectTypeOf<WebhookConfig["eventTypes"]>().toEqualTypeOf<readonly WebhookEventType[]>();
    expectTypeOf<WebhookConfig["enabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<WebhookConfig["cryptoKeyId"]>().toEqualTypeOf<ApiKeyId | null>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<WebhookConfig["archived"]>().toEqualTypeOf<false>();
  });

  it("ArchivedWebhookConfig has archived as true literal", () => {
    expectTypeOf<ArchivedWebhookConfig["archived"]>().toEqualTypeOf<true>();
  });
});

describe("WebhookDelivery", () => {
  it("has correct field types", () => {
    expectTypeOf<WebhookDelivery["id"]>().toEqualTypeOf<WebhookDeliveryId>();
    expectTypeOf<WebhookDelivery["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<WebhookDelivery["webhookId"]>().toEqualTypeOf<WebhookId>();
    expectTypeOf<WebhookDelivery["eventType"]>().toEqualTypeOf<WebhookEventType>();
    expectTypeOf<WebhookDelivery["status"]>().toEqualTypeOf<WebhookDeliveryStatus>();
    expectTypeOf<WebhookDelivery["httpStatus"]>().toEqualTypeOf<number | null>();
    expectTypeOf<WebhookDelivery["attemptCount"]>().toEqualTypeOf<number>();
    expectTypeOf<WebhookDelivery["lastAttemptAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<WebhookDelivery["nextRetryAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<WebhookDelivery["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<WebhookDelivery["archivedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<WebhookDelivery["archived"]>().toEqualTypeOf<false>();
  });

  it("ArchivedWebhookDelivery has archived as true literal", () => {
    expectTypeOf<ArchivedWebhookDelivery["archived"]>().toEqualTypeOf<true>();
  });
});
