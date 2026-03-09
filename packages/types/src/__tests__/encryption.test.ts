import { describe, expectTypeOf, it } from "vitest";

import type { AuditActor, AuditLogEntry } from "../audit-log.js";
import type {
  AcknowledgementRequest,
  BoardMessage,
  Channel,
  ChatMessage,
  Note,
  Poll,
} from "../communication.js";
import type {
  BucketEncrypted,
  ClientAcknowledgementRequest,
  ClientAuditLogEntry,
  ClientBoardMessage,
  ClientChannel,
  ClientChatMessage,
  ClientCustomFront,
  ClientFieldDefinition,
  ClientFieldValue,
  ClientFrontingSession,
  ClientGroup,
  ClientInnerWorldEntity,
  ClientInnerWorldRegion,
  ClientJournalEntry,
  ClientLayer,
  ClientLifecycleEvent,
  ClientMember,
  ClientMemberPhoto,
  ClientNote,
  ClientPoll,
  ClientRelationship,
  ClientSideSystem,
  ClientSubsystem,
  ClientTimerConfig,
  ClientWikiPage,
  DecryptFn,
  Encrypted,
  EncryptedBlob,
  EncryptedString,
  EncryptFn,
  EncryptionAlgorithm,
  Plaintext,
  ServerAcknowledgementRequest,
  ServerAuditLogEntry,
  ServerBoardMessage,
  ServerChannel,
  ServerChatMessage,
  ServerCustomFront,
  ServerFieldDefinition,
  ServerFieldValue,
  ServerFrontingSession,
  ServerGroup,
  ServerJournalEntry,
  ServerLayer,
  ServerLifecycleEvent,
  ServerInnerWorldEntity,
  ServerInnerWorldRegion,
  ServerMember,
  ServerMemberPhoto,
  ServerNote,
  ServerPoll,
  ServerRelationship,
  ServerSideSystem,
  ServerSubsystem,
  ServerTimerConfig,
  ServerWikiPage,
} from "../encryption.js";
import type { CustomFront, FrontingSession } from "../fronting.js";
import type { Group } from "../groups.js";
import type { CompletenessLevel, Member, MemberPhoto } from "../identity.js";
import type { BlobId, BucketId, MemberId } from "../ids.js";
import type { JournalEntry, WikiPage } from "../journal.js";
import type { LifecycleEvent } from "../lifecycle.js";
import type { Layer, Relationship, SideSystem, Subsystem } from "../structure.js";
import type { TimerConfig } from "../timer.js";
import type { UnixMillis } from "../timestamps.js";

describe("Encrypted<T>", () => {
  it("is assignable to plain T (intersection subtype)", () => {
    // Encrypted<string> is `string & { ... }` — a subtype of string
    expectTypeOf<Encrypted<string>>().toExtend<string>();
  });

  it("is not assignable from plain T", () => {
    // Plain string is NOT assignable to Encrypted<string>
    expectTypeOf<string>().not.toExtend<Encrypted<string>>();
  });
});

describe("BucketEncrypted<T>", () => {
  it("is assignable to plain T (intersection subtype)", () => {
    expectTypeOf<BucketEncrypted<string>>().toExtend<string>();
  });

  it("is not assignable from plain T", () => {
    expectTypeOf<string>().not.toExtend<BucketEncrypted<string>>();
  });

  it("is not interchangeable with Encrypted<T>", () => {
    // @ts-expect-error different tier brands
    expectTypeOf<Encrypted<string>>().toEqualTypeOf<BucketEncrypted<string>>();
  });
});

describe("EncryptedBlob", () => {
  it("has expected fields", () => {
    expectTypeOf<EncryptedBlob["ciphertext"]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<EncryptedBlob["nonce"]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<EncryptedBlob["tier"]>().toEqualTypeOf<1 | 2>();
    expectTypeOf<EncryptedBlob["algorithm"]>().toEqualTypeOf<EncryptionAlgorithm>();
    expectTypeOf<EncryptedBlob["keyVersion"]>().toEqualTypeOf<number | null>();
    expectTypeOf<EncryptedBlob["bucketId"]>().toEqualTypeOf<BucketId | null>();
  });
});

describe("EncryptedString", () => {
  it("is not assignable from plain string", () => {
    expectTypeOf<string>().not.toExtend<EncryptedString>();
  });

  it("is assignable to plain string (intersection subtype)", () => {
    expectTypeOf<EncryptedString>().toExtend<string>();
  });
});

describe("Plaintext<T>", () => {
  it("is assignable to plain T (intersection subtype)", () => {
    expectTypeOf<Plaintext<string>>().toExtend<string>();
  });

  it("is not assignable from plain T", () => {
    expectTypeOf<string>().not.toExtend<Plaintext<string>>();
  });
});

describe("ServerMember", () => {
  it("has encryptedData field", () => {
    expectTypeOf<ServerMember["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
  });

  it("has T3 plaintext fields", () => {
    expectTypeOf<ServerMember["completenessLevel"]>().toEqualTypeOf<CompletenessLevel>();
    expectTypeOf<ServerMember["archived"]>().toEqualTypeOf<boolean>();
  });

  it("has id and systemId", () => {
    expectTypeOf<ServerMember["id"]>().toEqualTypeOf<MemberId>();
  });
});

describe("ClientMember", () => {
  it("has flat decrypted fields matching Member", () => {
    expectTypeOf<ClientMember>().toEqualTypeOf<Member>();
  });

  it("has name as string", () => {
    expectTypeOf<ClientMember["name"]>().toEqualTypeOf<string>();
  });
});

describe("Server/Client pairs exist for completed domains", () => {
  it("fronting pair", () => {
    expectTypeOf<ServerFrontingSession>().toBeObject();
    expectTypeOf<ClientFrontingSession>().toEqualTypeOf<FrontingSession>();
  });

  it("group pair", () => {
    expectTypeOf<ServerGroup>().toBeObject();
    expectTypeOf<ClientGroup>().toEqualTypeOf<Group>();
  });

  it("subsystem pair", () => {
    expectTypeOf<ServerSubsystem>().toBeObject();
    expectTypeOf<ClientSubsystem>().toEqualTypeOf<Subsystem>();
  });

  it("relationship pair", () => {
    expectTypeOf<ServerRelationship>().toBeObject();
    expectTypeOf<ClientRelationship>().toEqualTypeOf<Relationship>();
  });

  it("custom front pair", () => {
    expectTypeOf<ServerCustomFront>().toBeObject();
    expectTypeOf<ServerCustomFront["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerCustomFront["archived"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ClientCustomFront>().toEqualTypeOf<CustomFront>();
  });

  it("journal entry pair", () => {
    expectTypeOf<ServerJournalEntry>().toBeObject();
    expectTypeOf<ServerJournalEntry["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerJournalEntry["archived"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ClientJournalEntry>().toEqualTypeOf<JournalEntry>();
  });

  it("wiki page pair", () => {
    expectTypeOf<ServerWikiPage>().toBeObject();
    expectTypeOf<ServerWikiPage["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerWikiPage["archived"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ClientWikiPage>().toEqualTypeOf<WikiPage>();
  });

  it("member photo pair", () => {
    expectTypeOf<ServerMemberPhoto>().toBeObject();
    expectTypeOf<ServerMemberPhoto["encryptedData"]>().toEqualTypeOf<EncryptedBlob | null>();
    expectTypeOf<ServerMemberPhoto["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ServerMemberPhoto["blobRef"]>().toEqualTypeOf<BlobId>();
    expectTypeOf<ServerMemberPhoto["sortOrder"]>().toEqualTypeOf<number>();
    expectTypeOf<ClientMemberPhoto>().toEqualTypeOf<MemberPhoto>();
  });

  it("poll pair", () => {
    expectTypeOf<ServerPoll>().toBeObject();
    expectTypeOf<ServerPoll["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerPoll["createdByMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ServerPoll["status"]>().toEqualTypeOf<"open" | "closed">();
    expectTypeOf<ServerPoll["closedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<ServerPoll["allowMultipleVotes"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ServerPoll["maxVotesPerMember"]>().toEqualTypeOf<number>();
    expectTypeOf<ClientPoll>().toEqualTypeOf<Poll>();
  });

  it("acknowledgement request pair", () => {
    expectTypeOf<ServerAcknowledgementRequest>().toBeObject();
    expectTypeOf<ServerAcknowledgementRequest["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerAcknowledgementRequest["createdByMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ServerAcknowledgementRequest["targetMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ServerAcknowledgementRequest["confirmed"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ServerAcknowledgementRequest["confirmedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<ClientAcknowledgementRequest>().toEqualTypeOf<AcknowledgementRequest>();
  });

  it("side system pair", () => {
    expectTypeOf<ServerSideSystem>().toBeObject();
    expectTypeOf<ServerSideSystem["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ClientSideSystem>().toEqualTypeOf<SideSystem>();
  });

  it("layer pair", () => {
    expectTypeOf<ServerLayer>().toBeObject();
    expectTypeOf<ServerLayer["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerLayer["accessType"]>().toEqualTypeOf<"open" | "gatekept">();
    expectTypeOf<ServerLayer["gatekeeperMemberId"]>().toEqualTypeOf<MemberId | null>();
    expectTypeOf<ClientLayer>().toEqualTypeOf<Layer>();
  });

  it("timer config pair", () => {
    expectTypeOf<ServerTimerConfig>().toBeObject();
    expectTypeOf<ServerTimerConfig["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerTimerConfig["intervalMinutes"]>().toEqualTypeOf<number>();
    expectTypeOf<ServerTimerConfig["wakingHoursOnly"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ServerTimerConfig["enabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ClientTimerConfig>().toEqualTypeOf<TimerConfig>();
  });

  it("audit log entry pair", () => {
    expectTypeOf<ServerAuditLogEntry>().toBeObject();
    expectTypeOf<ServerAuditLogEntry["encryptedData"]>().toEqualTypeOf<EncryptedBlob | null>();
    expectTypeOf<ServerAuditLogEntry["actor"]>().toEqualTypeOf<AuditActor>();
    expectTypeOf<ServerAuditLogEntry["ipAddress"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ServerAuditLogEntry["userAgent"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ClientAuditLogEntry>().toEqualTypeOf<AuditLogEntry>();
  });

  it("channel pair", () => {
    expectTypeOf<ServerChannel>().toBeObject();
    expectTypeOf<ServerChannel["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerChannel["type"]>().toEqualTypeOf<"category" | "channel">();
    expectTypeOf<ClientChannel>().toEqualTypeOf<Channel>();
  });

  it("chat message pair", () => {
    expectTypeOf<ServerChatMessage>().toBeObject();
    expectTypeOf<ServerChatMessage["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerChatMessage["senderId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ClientChatMessage>().toEqualTypeOf<ChatMessage>();
  });

  it("board message pair", () => {
    expectTypeOf<ServerBoardMessage>().toBeObject();
    expectTypeOf<ServerBoardMessage["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerBoardMessage["senderId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ServerBoardMessage["pinned"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ClientBoardMessage>().toEqualTypeOf<BoardMessage>();
  });

  it("note pair", () => {
    expectTypeOf<ServerNote>().toBeObject();
    expectTypeOf<ServerNote["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ClientNote>().toEqualTypeOf<Note>();
  });

  it("field definition pair", () => {
    expectTypeOf<ServerFieldDefinition>().toBeObject();
    expectTypeOf<ServerFieldDefinition["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ClientFieldDefinition>().toBeObject();
  });

  it("field value pair", () => {
    expectTypeOf<ServerFieldValue>().toBeObject();
    expectTypeOf<ServerFieldValue["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ClientFieldValue>().toBeObject();
  });

  it("lifecycle event pair", () => {
    expectTypeOf<ServerLifecycleEvent>().toBeObject();
    expectTypeOf<ServerLifecycleEvent["encryptedData"]>().toEqualTypeOf<EncryptedBlob | null>();
    expectTypeOf<ClientLifecycleEvent>().toEqualTypeOf<LifecycleEvent>();
  });

  it("innerworld entity pair", () => {
    expectTypeOf<ServerInnerWorldEntity>().toBeObject();
    expectTypeOf<ServerInnerWorldEntity["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ClientInnerWorldEntity>().toBeObject();
  });

  it("innerworld region pair", () => {
    expectTypeOf<ServerInnerWorldRegion>().toBeObject();
    expectTypeOf<ServerInnerWorldRegion["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ClientInnerWorldRegion>().toBeObject();
  });
});

describe("DecryptFn and EncryptFn", () => {
  it("DecryptFn maps server to client", () => {
    type Fn = DecryptFn<ServerMember, ClientMember>;
    expectTypeOf<Fn>().toBeFunction();
    expectTypeOf<Parameters<Fn>[0]>().toEqualTypeOf<ServerMember>();
    expectTypeOf<Parameters<Fn>[1]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<ReturnType<Fn>>().toEqualTypeOf<ClientMember>();
  });

  it("EncryptFn maps client to server", () => {
    type Fn = EncryptFn<ClientMember, ServerMember>;
    expectTypeOf<Fn>().toBeFunction();
    expectTypeOf<Parameters<Fn>[0]>().toEqualTypeOf<ClientMember>();
    expectTypeOf<Parameters<Fn>[1]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<ReturnType<Fn>>().toEqualTypeOf<ServerMember>();
  });
});
