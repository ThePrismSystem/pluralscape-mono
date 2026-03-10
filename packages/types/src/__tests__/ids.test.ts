import { assertType, describe, expect, expectTypeOf, it } from "vitest";

import { ID_PREFIXES } from "../ids.js";

import type {
  AccountId,
  AcknowledgementId,
  ApiKeyId,
  AuditLogEntryId,
  BlobId,
  BoardMessageId,
  Brand,
  BucketId,
  ChannelId,
  CheckInRecordId,
  CustomFrontId,
  DeviceTokenId,
  EntityType,
  EventId,
  FieldDefinitionId,
  FieldValueId,
  FriendCodeId,
  FriendConnectionId,
  FriendNotificationPreferenceId,
  FrontingSessionId,
  GroupId,
  HexColor,
  InnerWorldEntityId,
  InnerWorldRegionId,
  JournalEntryId,
  KeyGrantId,
  LayerId,
  MemberId,
  MemberPhotoId,
  MessageId,
  NoteId,
  NotificationConfigId,
  PollId,
  PollOptionId,
  PollVoteId,
  RelationshipId,
  SessionId,
  SideSystemId,
  SubsystemId,
  SwitchId,
  AuthKeyId,
  RecoveryKeyId,
  DeviceTransferRequestId,
  SyncDocumentId,
  SyncQueueItemId,
  SyncConflictId,
  ImportJobId,
  PKBridgeConfigId,
  AccountPurgeRequestId,
  JobId,
  SubscriptionId,
  WebhookDeliveryId,
  SystemId,
  SystemSettingsId,
  TimerId,
  WebhookId,
  WikiPageId,
} from "../ids.js";

describe("Brand generic", () => {
  it("works with non-string base types", () => {
    type NumericBrand = Brand<number, "Foo">;
    expectTypeOf<NumericBrand>().toExtend<number>();
    // @ts-expect-error plain number not assignable to branded type
    assertType<NumericBrand>(42);
  });
});

describe("branded ID types", () => {
  it("are not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to branded SystemId
    assertType<SystemId>("sys_abc");
    // @ts-expect-error plain string not assignable to branded MemberId
    assertType<MemberId>("mem_abc");
  });

  it("are not interchangeable between ID types", () => {
    type TestSystemId = SystemId;
    // @ts-expect-error SystemId not assignable to MemberId
    expectTypeOf<TestSystemId>().toEqualTypeOf<MemberId>();
    // @ts-expect-error SystemId not assignable to GroupId
    expectTypeOf<TestSystemId>().toEqualTypeOf<GroupId>();
  });

  it("BlobId and ApiKeyId are not interchangeable", () => {
    // @ts-expect-error BlobId not assignable to ApiKeyId
    expectTypeOf<BlobId>().toEqualTypeOf<ApiKeyId>();
  });

  it("FrontingSessionId and CustomFrontId are not interchangeable", () => {
    // @ts-expect-error FrontingSessionId not assignable to CustomFrontId
    expectTypeOf<FrontingSessionId>().toEqualTypeOf<CustomFrontId>();
  });

  it("are assignable to string", () => {
    expectTypeOf<SystemId>().toExtend<string>();
  });

  it("defines all 45 branded ID types as string-based", () => {
    expectTypeOf<SystemId>().toExtend<string>();
    expectTypeOf<MemberId>().toExtend<string>();
    expectTypeOf<GroupId>().toExtend<string>();
    expectTypeOf<BucketId>().toExtend<string>();
    expectTypeOf<ChannelId>().toExtend<string>();
    expectTypeOf<MessageId>().toExtend<string>();
    expectTypeOf<NoteId>().toExtend<string>();
    expectTypeOf<PollId>().toExtend<string>();
    expectTypeOf<RelationshipId>().toExtend<string>();
    expectTypeOf<SubsystemId>().toExtend<string>();
    expectTypeOf<FieldDefinitionId>().toExtend<string>();
    expectTypeOf<FieldValueId>().toExtend<string>();
    expectTypeOf<SessionId>().toExtend<string>();
    expectTypeOf<EventId>().toExtend<string>();
    expectTypeOf<AccountId>().toExtend<string>();
    expectTypeOf<BlobId>().toExtend<string>();
    expectTypeOf<ApiKeyId>().toExtend<string>();
    expectTypeOf<WebhookId>().toExtend<string>();
    expectTypeOf<TimerId>().toExtend<string>();
    expectTypeOf<JournalEntryId>().toExtend<string>();
    expectTypeOf<WikiPageId>().toExtend<string>();
    expectTypeOf<SideSystemId>().toExtend<string>();
    expectTypeOf<LayerId>().toExtend<string>();
    expectTypeOf<InnerWorldEntityId>().toExtend<string>();
    expectTypeOf<InnerWorldRegionId>().toExtend<string>();
    expectTypeOf<AuditLogEntryId>().toExtend<string>();
    expectTypeOf<BoardMessageId>().toExtend<string>();
    expectTypeOf<AcknowledgementId>().toExtend<string>();
    expectTypeOf<CheckInRecordId>().toExtend<string>();
    expectTypeOf<FriendConnectionId>().toExtend<string>();
    expectTypeOf<KeyGrantId>().toExtend<string>();
    expectTypeOf<FrontingSessionId>().toExtend<string>();
    expectTypeOf<CustomFrontId>().toExtend<string>();
    expectTypeOf<FriendCodeId>().toExtend<string>();
    expectTypeOf<PollVoteId>().toExtend<string>();
    expectTypeOf<DeviceTokenId>().toExtend<string>();
    expectTypeOf<NotificationConfigId>().toExtend<string>();
    expectTypeOf<SystemSettingsId>().toExtend<string>();
    expectTypeOf<PollOptionId>().toExtend<string>();
    expectTypeOf<MemberPhotoId>().toExtend<string>();
    expectTypeOf<SwitchId>().toExtend<string>();
    expectTypeOf<AuthKeyId>().toExtend<string>();
    expectTypeOf<RecoveryKeyId>().toExtend<string>();
    expectTypeOf<DeviceTransferRequestId>().toExtend<string>();
    expectTypeOf<SyncDocumentId>().toExtend<string>();
    expectTypeOf<SyncQueueItemId>().toExtend<string>();
    expectTypeOf<SyncConflictId>().toExtend<string>();
    expectTypeOf<ImportJobId>().toExtend<string>();
    expectTypeOf<PKBridgeConfigId>().toExtend<string>();
    expectTypeOf<AccountPurgeRequestId>().toExtend<string>();
    expectTypeOf<JobId>().toExtend<string>();
    expectTypeOf<SubscriptionId>().toExtend<string>();
    expectTypeOf<WebhookDeliveryId>().toExtend<string>();
    expectTypeOf<FriendNotificationPreferenceId>().toExtend<string>();
    expectTypeOf<HexColor>().toExtend<string>();
  });
});

describe("HexColor", () => {
  it("is a branded string", () => {
    expectTypeOf<HexColor>().toExtend<string>();
  });

  it("is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to branded HexColor
    assertType<HexColor>("#ff0000");
  });

  it("is not interchangeable with other branded types", () => {
    // @ts-expect-error HexColor not assignable to SystemId
    expectTypeOf<HexColor>().toEqualTypeOf<SystemId>();
  });
});

describe("ID_PREFIXES", () => {
  it("has string values for all entity prefixes", () => {
    expectTypeOf(ID_PREFIXES).toBeObject();
    expectTypeOf(ID_PREFIXES.system).toEqualTypeOf<"sys_">();
    expectTypeOf(ID_PREFIXES.member).toEqualTypeOf<"mem_">();
  });

  it("is a readonly const object", () => {
    expectTypeOf(ID_PREFIXES).toExtend<Readonly<Record<string, string>>>();
  });

  it("has all unique prefix values", () => {
    const values = Object.values(ID_PREFIXES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("has the same number of entries as EntityType members", () => {
    const prefixCount = Object.keys(ID_PREFIXES).length;
    expect(prefixCount).toBe(57);
  });
});

describe("EntityType", () => {
  it("is a string union", () => {
    expectTypeOf<EntityType>().toExtend<string>();
  });

  it("accepts valid entity types", () => {
    assertType<EntityType>("system");
    assertType<EntityType>("member");
    assertType<EntityType>("group");
    assertType<EntityType>("bucket");
    assertType<EntityType>("channel");
  });

  it("rejects invalid entity types", () => {
    // @ts-expect-error invalid entity type
    assertType<EntityType>("invalid");
    // @ts-expect-error invalid entity type
    assertType<EntityType>("user");
  });

  it("is exhaustive in a switch statement", () => {
    function handleEntity(type: EntityType): string {
      switch (type) {
        case "system":
        case "member":
        case "group":
        case "bucket":
        case "channel":
        case "message":
        case "note":
        case "poll":
        case "relationship":
        case "subsystem":
        case "side-system":
        case "layer":
        case "journal-entry":
        case "wiki-page":
        case "custom-front":
        case "fronting-session":
        case "blob":
        case "webhook":
        case "timer":
        case "board-message":
        case "acknowledgement":
        case "innerworld-entity":
        case "innerworld-region":
        case "field-definition":
        case "field-value":
        case "api-key":
        case "audit-log-entry":
        case "check-in-record":
        case "friend-connection":
        case "key-grant":
        case "device-token":
        case "poll-vote":
        case "session":
        case "event":
        case "account":
        case "friend-code":
        case "notification-config":
        case "system-settings":
        case "poll-option":
        case "member-photo":
        case "switch":
        case "auth-key":
        case "recovery-key":
        case "device-transfer-request":
        case "sync-document":
        case "sync-queue-item":
        case "sync-conflict":
        case "import-job":
        case "pk-bridge-config":
        case "account-purge-request":
        case "export-request":
        case "job":
        case "subscription":
        case "webhook-delivery":
        case "fronting-report":
        case "friend-notification-preference":
        case "fronting-comment":
          return type;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleEntity).toBeFunction();
  });
});
