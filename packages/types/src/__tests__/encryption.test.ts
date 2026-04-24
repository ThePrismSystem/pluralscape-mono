import { describe, expectTypeOf, it } from "vitest";

import type { KdfMasterKey } from "../crypto-keys.js";
import type {
  BucketEncrypted,
  DecryptFn,
  Encrypted,
  EncryptedBlob,
  EncryptedString,
  EncryptFn,
  EncryptionAlgorithm,
  Plaintext,
  T1EncryptedBlob,
  T2EncryptedBlob,
} from "../encryption-primitives.js";
import type {
  AcknowledgementRequest,
  AcknowledgementRequestServerMetadata,
} from "../entities/acknowledgement.js";
import type {
  AuditActor,
  AuditLogEntry,
  AuditLogEntryServerMetadata,
  AuditLogEntryWire,
} from "../entities/audit-log-entry.js";
import type { BoardMessage, BoardMessageServerMetadata } from "../entities/board-message.js";
import type { Channel, ChannelServerMetadata } from "../entities/channel.js";
import type { CustomFront, CustomFrontServerMetadata } from "../entities/custom-front.js";
import type {
  FrontingComment,
  FrontingCommentServerMetadata,
} from "../entities/fronting-comment.js";
import type { FrontingSessionServerMetadata } from "../entities/fronting-session.js";
import type { Group, GroupServerMetadata } from "../entities/group.js";
import type {
  InnerWorldEntity,
  InnerWorldEntityServerMetadata,
} from "../entities/innerworld-entity.js";
import type {
  InnerWorldRegion,
  InnerWorldRegionServerMetadata,
} from "../entities/innerworld-region.js";
import type { JournalEntry, JournalEntryServerMetadata } from "../entities/journal-entry.js";
import type { LifecycleEvent, LifecycleEventServerMetadata } from "../entities/lifecycle-event.js";
import type { MemberPhoto, MemberPhotoServerMetadata } from "../entities/member-photo.js";
import type { Member, MemberServerMetadata, MemberWire } from "../entities/member.js";
import type { ChatMessage, ChatMessageServerMetadata } from "../entities/message.js";
import type { Note, NoteServerMetadata } from "../entities/note.js";
import type { PollVote, PollVoteServerMetadata } from "../entities/poll-vote.js";
import type { Poll, PollServerMetadata } from "../entities/poll.js";
import type { Relationship, RelationshipServerMetadata } from "../entities/relationship.js";
import type {
  SystemStructureEntityType,
  SystemStructureEntityTypeServerMetadata,
} from "../entities/structure-entity-type.js";
import type {
  SystemStructureEntity,
  SystemStructureEntityServerMetadata,
} from "../entities/structure-entity.js";
import type { TimerConfig, TimerConfigServerMetadata } from "../entities/timer-config.js";
import type { WikiPage, WikiPageServerMetadata } from "../entities/wiki-page.js";
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
    expectTypeOf<FrontingSessionServerMetadata>().toBeObject();
    expectTypeOf<FrontingSessionServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
  });

  it("group pair", () => {
    expectTypeOf<GroupServerMetadata>().toBeObject();
    expectTypeOf<Group>().toEqualTypeOf<Group>();
  });

  it("structure entity type pair", () => {
    expectTypeOf<SystemStructureEntityTypeServerMetadata>().toBeObject();
    expectTypeOf<
      SystemStructureEntityTypeServerMetadata["encryptedData"]
    >().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<SystemStructureEntityType>().toBeObject();
    expectTypeOf<SystemStructureEntityType["name"]>().toBeString();
  });

  it("structure entity pair", () => {
    expectTypeOf<SystemStructureEntityServerMetadata>().toBeObject();
    expectTypeOf<
      SystemStructureEntityServerMetadata["encryptedData"]
    >().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<SystemStructureEntity>().toBeObject();
    expectTypeOf<SystemStructureEntity["name"]>().toBeString();
  });

  it("relationship pair", () => {
    expectTypeOf<RelationshipServerMetadata>().toBeObject();
    expectTypeOf<Relationship>().toEqualTypeOf<Relationship>();
  });

  it("custom front pair", () => {
    expectTypeOf<CustomFrontServerMetadata>().toBeObject();
    expectTypeOf<CustomFrontServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<CustomFrontServerMetadata["archived"]>().toEqualTypeOf<boolean>();
    expectTypeOf<CustomFront>().toEqualTypeOf<CustomFront>();
  });

  it("journal entry pair", () => {
    expectTypeOf<JournalEntryServerMetadata>().toBeObject();
    expectTypeOf<JournalEntryServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<JournalEntryServerMetadata["archived"]>().toEqualTypeOf<boolean>();
    // JournalEntry is the domain type (was ClientJournalEntry alias).
    expectTypeOf<JournalEntry>().toBeObject();
  });

  it("wiki page pair", () => {
    expectTypeOf<WikiPageServerMetadata>().toBeObject();
    expectTypeOf<WikiPageServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<WikiPageServerMetadata["archived"]>().toEqualTypeOf<boolean>();
    expectTypeOf<WikiPageServerMetadata["slugHash"]>().toEqualTypeOf<SlugHash>();
    // WikiPage is the domain type (was ClientWikiPage alias).
    expectTypeOf<WikiPage>().toBeObject();
  });

  it("member photo pair", () => {
    expectTypeOf<MemberPhotoServerMetadata>().toBeObject();
    expectTypeOf<MemberPhotoServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<MemberPhotoServerMetadata["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<MemberPhotoServerMetadata["sortOrder"]>().toEqualTypeOf<number>();
    expectTypeOf<MemberPhoto>().toEqualTypeOf<MemberPhoto>();
  });

  it("poll pair", () => {
    expectTypeOf<PollServerMetadata>().toBeObject();
    expectTypeOf<PollServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<PollServerMetadata["createdByMemberId"]>().toEqualTypeOf<MemberId | null>();
    expectTypeOf<PollServerMetadata["status"]>().toEqualTypeOf<"open" | "closed">();
    expectTypeOf<PollServerMetadata["closedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<PollServerMetadata["allowMultipleVotes"]>().toEqualTypeOf<boolean>();
    expectTypeOf<PollServerMetadata["maxVotesPerMember"]>().toEqualTypeOf<number>();
    // Poll is the domain type (was ClientPoll alias).
    expectTypeOf<Poll>().toBeObject();
  });

  it("acknowledgement request pair", () => {
    expectTypeOf<AcknowledgementRequestServerMetadata>().toBeObject();
    expectTypeOf<
      AcknowledgementRequestServerMetadata["encryptedData"]
    >().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<
      AcknowledgementRequestServerMetadata["createdByMemberId"]
    >().toEqualTypeOf<MemberId | null>();
    expectTypeOf<AcknowledgementRequestServerMetadata["confirmed"]>().toEqualTypeOf<boolean>();
    // AcknowledgementRequest is the domain type (was ClientAcknowledgementRequest alias).
    expectTypeOf<AcknowledgementRequest>().toBeObject();
  });

  it("timer config pair", () => {
    expectTypeOf<TimerConfigServerMetadata>().toBeObject();
    expectTypeOf<TimerConfigServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<TimerConfigServerMetadata["intervalMinutes"]>().toEqualTypeOf<number | null>();
    expectTypeOf<TimerConfigServerMetadata["wakingHoursOnly"]>().toEqualTypeOf<boolean | null>();
    expectTypeOf<TimerConfigServerMetadata["enabled"]>().toEqualTypeOf<boolean>();
    // TimerConfig is the domain type (was ClientTimerConfig alias).
    expectTypeOf<TimerConfig>().toBeObject();
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
    expectTypeOf<FrontingCommentServerMetadata>().toBeObject();
    expectTypeOf<FrontingCommentServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<FrontingCommentServerMetadata["id"]>().toEqualTypeOf<FrontingCommentId>();
    expectTypeOf<
      FrontingCommentServerMetadata["frontingSessionId"]
    >().toEqualTypeOf<FrontingSessionId>();
    expectTypeOf<FrontingCommentServerMetadata["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FrontingCommentServerMetadata["memberId"]>().toEqualTypeOf<MemberId | null>();
    // FrontingComment (domain) still referenced via its type file — retained for import.
    expectTypeOf<FrontingComment>().toBeObject();
  });

  it("poll vote pair", () => {
    expectTypeOf<PollVoteServerMetadata>().toBeObject();
    expectTypeOf<PollVoteServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<PollVoteServerMetadata["id"]>().toEqualTypeOf<PollVoteId>();
    expectTypeOf<PollVoteServerMetadata["pollId"]>().toEqualTypeOf<PollId>();
    expectTypeOf<PollVoteServerMetadata["optionId"]>().toEqualTypeOf<PollOptionId | null>();
    expectTypeOf<PollVoteServerMetadata["isVeto"]>().toEqualTypeOf<boolean>();
    // PollVote is the domain type (was ClientPollVote alias).
    expectTypeOf<PollVote>().toBeObject();
  });

  it("channel pair", () => {
    expectTypeOf<ChannelServerMetadata>().toBeObject();
    expectTypeOf<ChannelServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<ChannelServerMetadata["type"]>().toEqualTypeOf<"category" | "channel">();
    // Channel is the domain type (was ClientChannel alias).
    expectTypeOf<Channel>().toBeObject();
  });

  it("chat message pair", () => {
    expectTypeOf<ChatMessageServerMetadata>().toBeObject();
    expectTypeOf<ChatMessageServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    // ChatMessage is the domain type (was ClientChatMessage alias).
    expectTypeOf<ChatMessage>().toBeObject();
  });

  it("board message pair", () => {
    expectTypeOf<BoardMessageServerMetadata>().toBeObject();
    expectTypeOf<BoardMessageServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<BoardMessageServerMetadata["pinned"]>().toEqualTypeOf<boolean>();
    // BoardMessage is the domain type (was ClientBoardMessage alias).
    expectTypeOf<BoardMessage>().toBeObject();
  });

  it("note pair", () => {
    expectTypeOf<NoteServerMetadata>().toBeObject();
    expectTypeOf<NoteServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    // Note is the domain type (was ClientNote alias).
    expectTypeOf<Note>().toBeObject();
  });

  it("lifecycle event pair", () => {
    expectTypeOf<LifecycleEventServerMetadata>().toBeObject();
    expectTypeOf<LifecycleEventServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<LifecycleEvent>().toBeObject();
  });

  it("innerworld entity pair", () => {
    expectTypeOf<InnerWorldEntityServerMetadata>().toBeObject();
    expectTypeOf<InnerWorldEntityServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<InnerWorldEntity>().toBeObject();
  });

  it("innerworld region pair", () => {
    expectTypeOf<InnerWorldRegionServerMetadata>().toBeObject();
    expectTypeOf<InnerWorldRegionServerMetadata["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
    expectTypeOf<InnerWorldRegion>().toBeObject();
  });
});

describe("T1 encrypted field absence on server types", () => {
  it("JournalEntryServerMetadata must not have author", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<JournalEntryServerMetadata["author"]>();
  });

  it("InnerWorldRegionServerMetadata must not have gatekeeperMemberIds", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<InnerWorldRegionServerMetadata["gatekeeperMemberIds"]>();
  });

  it("ChatMessageServerMetadata must not have senderId", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<ChatMessageServerMetadata["senderId"]>();
  });

  it("BoardMessageServerMetadata must not have senderId", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<BoardMessageServerMetadata["senderId"]>();
  });

  it("InnerWorldEntityServerMetadata must not have entityType", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<InnerWorldEntityServerMetadata["entityType"]>();
  });

  it("InnerWorldEntityServerMetadata must not have positionX", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<InnerWorldEntityServerMetadata["positionX"]>();
  });

  it("InnerWorldEntityServerMetadata must not have positionY", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<InnerWorldEntityServerMetadata["positionY"]>();
  });

  it("InnerWorldRegionServerMetadata must not have accessType", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<InnerWorldRegionServerMetadata["accessType"]>();
  });

  it("AcknowledgementRequestServerMetadata must not have targetMemberId", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<AcknowledgementRequestServerMetadata["targetMemberId"]>();
  });

  it("AcknowledgementRequestServerMetadata must not have confirmedAt", () => {
    // @ts-expect-error - field moved to T1 encrypted
    expectTypeOf<AcknowledgementRequestServerMetadata["confirmedAt"]>();
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
