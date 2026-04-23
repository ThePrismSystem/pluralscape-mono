import { describe, expectTypeOf, it } from "vitest";

import type { AuditActor, AuditLogEntry } from "../audit-log.js";
import type {
  AcknowledgementRequest,
  BoardMessage,
  Channel,
  ChatMessage,
  Note,
  Poll,
  PollVote,
} from "../communication.js";
import type { KdfMasterKey } from "../crypto-keys.js";
import type {
  BucketEncrypted,
  AuditLogEntryWire,
  ClientAcknowledgementRequest,
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
  ClientLifecycleEvent,
  ClientMemberPhoto,
  ClientNote,
  ClientPoll,
  ClientRelationship,
  ClientStructureEntity,
  ClientStructureEntityType,
  ClientTimerConfig,
  ClientWikiPage,
  DecryptFn,
  Encrypted,
  EncryptedBlob,
  EncryptedString,
  EncryptFn,
  EncryptionAlgorithm,
  MemberWire,
  Plaintext,
  AuditLogEntryServerMetadata,
  ServerAcknowledgementRequest,
  ServerBoardMessage,
  ServerChannel,
  ServerChatMessage,
  ServerCustomFront,
  ServerFieldDefinition,
  ServerFieldValue,
  ServerFrontingSession,
  ServerGroup,
  ServerJournalEntry,
  ServerLifecycleEvent,
  ServerInnerWorldEntity,
  ServerInnerWorldRegion,
  MemberServerMetadata,
  ServerMemberPhoto,
  ServerNote,
  ServerPoll,
  ServerRelationship,
  ServerStructureEntity,
  ServerStructureEntityType,
  ServerTimerConfig,
  ServerFrontingComment,
  ClientFrontingComment,
  ServerPollVote,
  ClientPollVote,
  ServerWikiPage,
  T1EncryptedBlob,
  T2EncryptedBlob,
} from "../encryption.js";
import type { CustomFront } from "../entities/custom-front.js";
import type { FrontingComment } from "../entities/fronting-comment.js";
import type { FrontingSession } from "../entities/fronting-session.js";
import type { MemberPhoto } from "../entities/member-photo.js";
import type { Member } from "../entities/member.js";
import type { Group } from "../groups.js";
import type {
  BucketId,
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  PollId,
  PollOptionId,
  PollVoteId,
  SlugHash,
  SystemId,
} from "../ids.js";
import type { JournalEntry, WikiPage } from "../journal.js";
import type { LifecycleEvent } from "../lifecycle.js";
import type { Relationship } from "../structure.js";
import type { TimerConfig } from "../timer.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

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

  it("discriminates T1 (bucketId: null) from T2 (bucketId: BucketId)", () => {
    expectTypeOf<T1EncryptedBlob["tier"]>().toEqualTypeOf<1>();
    expectTypeOf<T1EncryptedBlob["bucketId"]>().toEqualTypeOf<null>();
    expectTypeOf<T2EncryptedBlob["tier"]>().toEqualTypeOf<2>();
    expectTypeOf<T2EncryptedBlob["bucketId"]>().toEqualTypeOf<BucketId>();
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

describe("MemberServerMetadata", () => {
  it("has encryptedData field", () => {
    expectTypeOf<MemberServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
  });

  it("has T3 plaintext fields", () => {
    expectTypeOf<MemberServerMetadata["archived"]>().toEqualTypeOf<boolean>();
  });

  it("has id and systemId", () => {
    expectTypeOf<MemberServerMetadata["id"]>().toEqualTypeOf<MemberId>();
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

  it("structure entity type pair", () => {
    expectTypeOf<ServerStructureEntityType>().toBeObject();
    expectTypeOf<ServerStructureEntityType["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ClientStructureEntityType>().toBeObject();
    expectTypeOf<ClientStructureEntityType["name"]>().toBeString();
  });

  it("structure entity pair", () => {
    expectTypeOf<ServerStructureEntity>().toBeObject();
    expectTypeOf<ServerStructureEntity["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ClientStructureEntity>().toBeObject();
    expectTypeOf<ClientStructureEntity["name"]>().toBeString();
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
    expectTypeOf<ServerWikiPage["slugHash"]>().toEqualTypeOf<SlugHash>();
    expectTypeOf<ClientWikiPage>().toEqualTypeOf<WikiPage>();
  });

  it("member photo pair", () => {
    expectTypeOf<ServerMemberPhoto>().toBeObject();
    expectTypeOf<ServerMemberPhoto["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerMemberPhoto["memberId"]>().toEqualTypeOf<MemberId>();
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
    expectTypeOf<
      ServerAcknowledgementRequest["createdByMemberId"]
    >().toEqualTypeOf<MemberId | null>();
    expectTypeOf<ServerAcknowledgementRequest["confirmed"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ClientAcknowledgementRequest>().toEqualTypeOf<AcknowledgementRequest>();
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
    expectTypeOf<AuditLogEntryServerMetadata>().toBeObject();
    expectTypeOf<AuditLogEntryServerMetadata["detail"]>().toEqualTypeOf<string | null>();
    expectTypeOf<AuditLogEntryServerMetadata["timestamp"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<AuditLogEntryServerMetadata["actor"]>().toEqualTypeOf<AuditActor>();
    expectTypeOf<AuditLogEntryServerMetadata["ipAddress"]>().toEqualTypeOf<string | null>();
    expectTypeOf<AuditLogEntryServerMetadata["userAgent"]>().toEqualTypeOf<string | null>();
  });

  it("fronting comment pair", () => {
    expectTypeOf<ServerFrontingComment>().toBeObject();
    expectTypeOf<ServerFrontingComment["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ServerFrontingComment["id"]>().toEqualTypeOf<FrontingCommentId>();
    expectTypeOf<ServerFrontingComment["frontingSessionId"]>().toEqualTypeOf<FrontingSessionId>();
    expectTypeOf<ServerFrontingComment["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ServerFrontingComment["memberId"]>().toEqualTypeOf<MemberId | null>();
    expectTypeOf<ClientFrontingComment>().toEqualTypeOf<FrontingComment>();
  });

  it("poll vote pair", () => {
    expectTypeOf<ServerPollVote>().toBeObject();
    expectTypeOf<ServerPollVote["encryptedData"]>().toEqualTypeOf<EncryptedBlob | null>();
    expectTypeOf<ServerPollVote["id"]>().toEqualTypeOf<PollVoteId>();
    expectTypeOf<ServerPollVote["pollId"]>().toEqualTypeOf<PollId>();
    expectTypeOf<ServerPollVote["optionId"]>().toEqualTypeOf<PollOptionId | null>();
    expectTypeOf<ServerPollVote["isVeto"]>().toEqualTypeOf<boolean | null>();
    expectTypeOf<ClientPollVote>().toEqualTypeOf<PollVote>();
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
    expectTypeOf<ClientChatMessage>().toEqualTypeOf<ChatMessage>();
  });

  it("board message pair", () => {
    expectTypeOf<ServerBoardMessage>().toBeObject();
    expectTypeOf<ServerBoardMessage["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
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

describe("T1 encrypted field absence on server types", () => {
  it("ServerJournalEntry must not have author", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<ServerJournalEntry["author"]>();
  });

  it("ServerInnerWorldRegion must not have gatekeeperMemberIds", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<ServerInnerWorldRegion["gatekeeperMemberIds"]>();
  });

  it("ServerChatMessage must not have senderId", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<ServerChatMessage["senderId"]>();
  });

  it("ServerBoardMessage must not have senderId", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<ServerBoardMessage["senderId"]>();
  });

  it("ServerInnerWorldEntity must not have entityType", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<ServerInnerWorldEntity["entityType"]>();
  });

  it("ServerInnerWorldEntity must not have positionX", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<ServerInnerWorldEntity["positionX"]>();
  });

  it("ServerInnerWorldEntity must not have positionY", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<ServerInnerWorldEntity["positionY"]>();
  });

  it("ServerInnerWorldRegion must not have accessType", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<ServerInnerWorldRegion["accessType"]>();
  });

  it("ServerAcknowledgementRequest must not have targetMemberId", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<ServerAcknowledgementRequest["targetMemberId"]>();
  });

  it("ServerAcknowledgementRequest must not have confirmedAt", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<ServerAcknowledgementRequest["confirmedAt"]>();
  });
});

describe("DecryptFn and EncryptFn", () => {
  it("DecryptFn maps server to client", () => {
    type Fn = DecryptFn<MemberServerMetadata, Member>;
    expectTypeOf<Fn>().toBeFunction();
    expectTypeOf<Parameters<Fn>[0]>().toEqualTypeOf<MemberServerMetadata>();
    expectTypeOf<Parameters<Fn>[1]>().toEqualTypeOf<KdfMasterKey>();
    expectTypeOf<ReturnType<Fn>>().toEqualTypeOf<Member>();
  });

  it("EncryptFn maps client to server", () => {
    type Fn = EncryptFn<Member, MemberServerMetadata>;
    expectTypeOf<Fn>().toBeFunction();
    expectTypeOf<Parameters<Fn>[0]>().toEqualTypeOf<Member>();
    expectTypeOf<Parameters<Fn>[1]>().toEqualTypeOf<KdfMasterKey>();
    expectTypeOf<ReturnType<Fn>>().toEqualTypeOf<MemberServerMetadata>();
  });
});

describe("MemberWire", () => {
  it("equals Serialize<Member>", () => {
    expectTypeOf<MemberWire>().toEqualTypeOf<Serialize<Member>>();
  });

  it("has `id` as plain string (brand stripped)", () => {
    expectTypeOf<MemberWire["id"]>().toEqualTypeOf<string>();
  });

  it("has audit timestamps serialized to number (UnixMillis → number)", () => {
    // Domain Member includes audit UnixMillis fields (createdAt, updatedAt);
    // Wire should have them as plain number after Serialize.
    expectTypeOf<MemberWire["createdAt"]>().toEqualTypeOf<number>();
  });
});

describe("AuditLogEntryWire", () => {
  it("equals Serialize<AuditLogEntry>", () => {
    expectTypeOf<AuditLogEntryWire>().toEqualTypeOf<Serialize<AuditLogEntry>>();
  });

  it("has `id` as plain string (brand stripped)", () => {
    expectTypeOf<AuditLogEntryWire["id"]>().toEqualTypeOf<string>();
  });
});
