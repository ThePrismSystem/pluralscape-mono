import { describe, expectTypeOf, it, expect } from "vitest";

import { serverSafe } from "../server-safe.js";

import type {
  ClientCustomFront,
  ClientFieldDefinition,
  ClientFieldValue,
  ClientFrontingComment,
  ClientFrontingSession,
  ClientGroup,
  ClientLifecycleEvent,
  ClientMemberPhoto,
  ClientRelationship,
  ClientStructureEntity,
  ClientStructureEntityType,
  ServerCustomFront,
  ServerFieldDefinition,
  ServerFieldValue,
  ServerFrontingComment,
  ServerFrontingSession,
  ServerGroup,
  ServerLifecycleEvent,
  ServerMemberPhoto,
  ServerRelationship,
  ServerStructureEntity,
  ServerStructureEntityType,
} from "../encryption-primitives.js";
import type {
  AcknowledgementRequest,
  AcknowledgementRequestServerMetadata,
} from "../entities/acknowledgement.js";
import type { AuditLogEntry, AuditLogEntryServerMetadata } from "../entities/audit-log-entry.js";
import type { BoardMessage, BoardMessageServerMetadata } from "../entities/board-message.js";
import type { Channel, ChannelServerMetadata } from "../entities/channel.js";
import type {
  InnerWorldEntity,
  InnerWorldEntityServerMetadata,
} from "../entities/innerworld-entity.js";
import type {
  InnerWorldRegion,
  InnerWorldRegionServerMetadata,
} from "../entities/innerworld-region.js";
import type { JournalEntry, JournalEntryServerMetadata } from "../entities/journal-entry.js";
import type { Member, MemberServerMetadata } from "../entities/member.js";
import type { ChatMessage, ChatMessageServerMetadata } from "../entities/message.js";
import type { Note, NoteServerMetadata } from "../entities/note.js";
import type { PollVote, PollVoteServerMetadata } from "../entities/poll-vote.js";
import type { Poll, PollServerMetadata } from "../entities/poll.js";
import type { TimerConfig, TimerConfigServerMetadata } from "../entities/timer-config.js";
import type { WikiPage, WikiPageServerMetadata } from "../entities/wiki-page.js";
import type { PaginatedResult } from "../pagination.js";
import type { ClientResponseData, ServerResponseData } from "../response-unions.js";
import type { ServerSafe } from "../server-safe.js";

// ── Count assertion ────────────────────────────────────────────────
// If a new Server*Metadata type is added but not to ServerResponseData, this
// tuple will have the wrong length.
type AllServerTypes = [
  MemberServerMetadata,
  ServerFrontingSession,
  ServerFrontingComment,
  ServerGroup,
  ServerStructureEntityType,
  ServerStructureEntity,
  ServerRelationship,
  ChannelServerMetadata,
  ChatMessageServerMetadata,
  BoardMessageServerMetadata,
  NoteServerMetadata,
  ServerFieldDefinition,
  ServerFieldValue,
  InnerWorldEntityServerMetadata,
  InnerWorldRegionServerMetadata,
  ServerLifecycleEvent,
  ServerCustomFront,
  JournalEntryServerMetadata,
  WikiPageServerMetadata,
  ServerMemberPhoto,
  PollServerMetadata,
  PollVoteServerMetadata,
  AcknowledgementRequestServerMetadata,
  TimerConfigServerMetadata,
  AuditLogEntryServerMetadata,
];

describe("serverSafe() — Server* types accepted", () => {
  it("accepts all 25 Server* types (count assertion)", () => {
    expectTypeOf<AllServerTypes["length"]>().toEqualTypeOf<25>();
  });

  it("MemberServerMetadata extends ServerResponseData", () => {
    expectTypeOf<MemberServerMetadata>().toExtend<ServerResponseData>();
  });

  it("ServerFrontingSession extends ServerResponseData", () => {
    expectTypeOf<ServerFrontingSession>().toExtend<ServerResponseData>();
  });

  it("ServerFrontingComment extends ServerResponseData", () => {
    expectTypeOf<ServerFrontingComment>().toExtend<ServerResponseData>();
  });

  it("ServerGroup extends ServerResponseData", () => {
    expectTypeOf<ServerGroup>().toExtend<ServerResponseData>();
  });

  it("ServerStructureEntityType extends ServerResponseData", () => {
    expectTypeOf<ServerStructureEntityType>().toExtend<ServerResponseData>();
  });

  it("ServerStructureEntity extends ServerResponseData", () => {
    expectTypeOf<ServerStructureEntity>().toExtend<ServerResponseData>();
  });

  it("ServerRelationship extends ServerResponseData", () => {
    expectTypeOf<ServerRelationship>().toExtend<ServerResponseData>();
  });

  it("ChannelServerMetadata extends ServerResponseData", () => {
    expectTypeOf<ChannelServerMetadata>().toExtend<ServerResponseData>();
  });

  it("ChatMessageServerMetadata extends ServerResponseData", () => {
    expectTypeOf<ChatMessageServerMetadata>().toExtend<ServerResponseData>();
  });

  it("BoardMessageServerMetadata extends ServerResponseData", () => {
    expectTypeOf<BoardMessageServerMetadata>().toExtend<ServerResponseData>();
  });

  it("NoteServerMetadata extends ServerResponseData", () => {
    expectTypeOf<NoteServerMetadata>().toExtend<ServerResponseData>();
  });

  it("ServerFieldDefinition extends ServerResponseData", () => {
    expectTypeOf<ServerFieldDefinition>().toExtend<ServerResponseData>();
  });

  it("ServerFieldValue extends ServerResponseData", () => {
    expectTypeOf<ServerFieldValue>().toExtend<ServerResponseData>();
  });

  it("InnerWorldEntityServerMetadata extends ServerResponseData", () => {
    expectTypeOf<InnerWorldEntityServerMetadata>().toExtend<ServerResponseData>();
  });

  it("InnerWorldRegionServerMetadata extends ServerResponseData", () => {
    expectTypeOf<InnerWorldRegionServerMetadata>().toExtend<ServerResponseData>();
  });

  it("ServerLifecycleEvent extends ServerResponseData", () => {
    expectTypeOf<ServerLifecycleEvent>().toExtend<ServerResponseData>();
  });

  it("ServerCustomFront extends ServerResponseData", () => {
    expectTypeOf<ServerCustomFront>().toExtend<ServerResponseData>();
  });

  it("JournalEntryServerMetadata extends ServerResponseData", () => {
    expectTypeOf<JournalEntryServerMetadata>().toExtend<ServerResponseData>();
  });

  it("WikiPageServerMetadata extends ServerResponseData", () => {
    expectTypeOf<WikiPageServerMetadata>().toExtend<ServerResponseData>();
  });

  it("ServerMemberPhoto extends ServerResponseData", () => {
    expectTypeOf<ServerMemberPhoto>().toExtend<ServerResponseData>();
  });

  it("PollServerMetadata extends ServerResponseData", () => {
    expectTypeOf<PollServerMetadata>().toExtend<ServerResponseData>();
  });

  it("PollVoteServerMetadata extends ServerResponseData", () => {
    expectTypeOf<PollVoteServerMetadata>().toExtend<ServerResponseData>();
  });

  it("AcknowledgementRequestServerMetadata extends ServerResponseData", () => {
    expectTypeOf<AcknowledgementRequestServerMetadata>().toExtend<ServerResponseData>();
  });

  it("TimerConfigServerMetadata extends ServerResponseData", () => {
    expectTypeOf<TimerConfigServerMetadata>().toExtend<ServerResponseData>();
  });

  it("AuditLogEntryServerMetadata extends ServerResponseData", () => {
    expectTypeOf<AuditLogEntryServerMetadata>().toExtend<ServerResponseData>();
  });
});

// ── Count assertion for ClientResponseData ──────────────────────────
// If a new Client* or domain type is added but not to ClientResponseData,
// this tuple will have the wrong length.
type AllClientTypes = [
  Member,
  ClientFrontingSession,
  ClientFrontingComment,
  ClientGroup,
  ClientStructureEntityType,
  ClientStructureEntity,
  ClientRelationship,
  Channel,
  ChatMessage,
  BoardMessage,
  Note,
  ClientFieldDefinition,
  ClientFieldValue,
  InnerWorldEntity,
  InnerWorldRegion,
  ClientLifecycleEvent,
  ClientCustomFront,
  JournalEntry,
  WikiPage,
  ClientMemberPhoto,
  Poll,
  PollVote,
  AcknowledgementRequest,
  TimerConfig,
  AuditLogEntry,
];

describe("ClientResponseData union completeness", () => {
  it("has all 25 client-side types (count assertion)", () => {
    expectTypeOf<AllClientTypes["length"]>().toEqualTypeOf<25>();
  });

  it("Member extends ClientResponseData", () => {
    expectTypeOf<Member>().toExtend<ClientResponseData>();
  });

  it("ClientFrontingSession extends ClientResponseData", () => {
    expectTypeOf<ClientFrontingSession>().toExtend<ClientResponseData>();
  });

  it("ClientFrontingComment extends ClientResponseData", () => {
    expectTypeOf<ClientFrontingComment>().toExtend<ClientResponseData>();
  });

  it("ClientGroup extends ClientResponseData", () => {
    expectTypeOf<ClientGroup>().toExtend<ClientResponseData>();
  });

  it("ClientStructureEntityType extends ClientResponseData", () => {
    expectTypeOf<ClientStructureEntityType>().toExtend<ClientResponseData>();
  });

  it("ClientStructureEntity extends ClientResponseData", () => {
    expectTypeOf<ClientStructureEntity>().toExtend<ClientResponseData>();
  });

  it("ClientRelationship extends ClientResponseData", () => {
    expectTypeOf<ClientRelationship>().toExtend<ClientResponseData>();
  });

  it("Channel extends ClientResponseData", () => {
    expectTypeOf<Channel>().toExtend<ClientResponseData>();
  });

  it("ChatMessage extends ClientResponseData", () => {
    expectTypeOf<ChatMessage>().toExtend<ClientResponseData>();
  });

  it("BoardMessage extends ClientResponseData", () => {
    expectTypeOf<BoardMessage>().toExtend<ClientResponseData>();
  });

  it("Note extends ClientResponseData", () => {
    expectTypeOf<Note>().toExtend<ClientResponseData>();
  });

  it("ClientFieldDefinition extends ClientResponseData", () => {
    expectTypeOf<ClientFieldDefinition>().toExtend<ClientResponseData>();
  });

  it("ClientFieldValue extends ClientResponseData", () => {
    expectTypeOf<ClientFieldValue>().toExtend<ClientResponseData>();
  });

  it("InnerWorldEntity extends ClientResponseData", () => {
    expectTypeOf<InnerWorldEntity>().toExtend<ClientResponseData>();
  });

  it("InnerWorldRegion extends ClientResponseData", () => {
    expectTypeOf<InnerWorldRegion>().toExtend<ClientResponseData>();
  });

  it("ClientLifecycleEvent extends ClientResponseData", () => {
    expectTypeOf<ClientLifecycleEvent>().toExtend<ClientResponseData>();
  });

  it("ClientCustomFront extends ClientResponseData", () => {
    expectTypeOf<ClientCustomFront>().toExtend<ClientResponseData>();
  });

  it("JournalEntry extends ClientResponseData", () => {
    expectTypeOf<JournalEntry>().toExtend<ClientResponseData>();
  });

  it("WikiPage extends ClientResponseData", () => {
    expectTypeOf<WikiPage>().toExtend<ClientResponseData>();
  });

  it("ClientMemberPhoto extends ClientResponseData", () => {
    expectTypeOf<ClientMemberPhoto>().toExtend<ClientResponseData>();
  });

  it("Poll extends ClientResponseData", () => {
    expectTypeOf<Poll>().toExtend<ClientResponseData>();
  });

  it("PollVote extends ClientResponseData", () => {
    expectTypeOf<PollVote>().toExtend<ClientResponseData>();
  });

  it("AcknowledgementRequest extends ClientResponseData", () => {
    expectTypeOf<AcknowledgementRequest>().toExtend<ClientResponseData>();
  });

  it("TimerConfig extends ClientResponseData", () => {
    expectTypeOf<TimerConfig>().toExtend<ClientResponseData>();
  });

  it("AuditLogEntry extends ClientResponseData", () => {
    expectTypeOf<AuditLogEntry>().toExtend<ClientResponseData>();
  });

  it("no Server* type extends ClientResponseData", () => {
    expectTypeOf<MemberServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerFrontingSession>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerFrontingComment>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerGroup>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerStructureEntityType>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerStructureEntity>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerRelationship>().not.toExtend<ClientResponseData>();
    expectTypeOf<ChannelServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<ChatMessageServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<BoardMessageServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<NoteServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerFieldDefinition>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerFieldValue>().not.toExtend<ClientResponseData>();
    expectTypeOf<InnerWorldEntityServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<InnerWorldRegionServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerLifecycleEvent>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerCustomFront>().not.toExtend<ClientResponseData>();
    expectTypeOf<JournalEntryServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<WikiPageServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerMemberPhoto>().not.toExtend<ClientResponseData>();
    expectTypeOf<PollServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<PollVoteServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<AcknowledgementRequestServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<TimerConfigServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<AuditLogEntryServerMetadata>().not.toExtend<ClientResponseData>();
  });
});

describe("serverSafe() — Client* types rejected", () => {
  it("Member does NOT extend ServerResponseData", () => {
    expectTypeOf<Member>().not.toExtend<ServerResponseData>();
  });

  it("ClientFrontingSession does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientFrontingSession>().not.toExtend<ServerResponseData>();
  });

  it("ClientFrontingComment does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientFrontingComment>().not.toExtend<ServerResponseData>();
  });

  it("ClientGroup does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientGroup>().not.toExtend<ServerResponseData>();
  });

  it("ClientStructureEntityType does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientStructureEntityType>().not.toExtend<ServerResponseData>();
  });

  it("ClientStructureEntity does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientStructureEntity>().not.toExtend<ServerResponseData>();
  });

  it("ClientRelationship does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientRelationship>().not.toExtend<ServerResponseData>();
  });

  it("Channel does NOT extend ServerResponseData", () => {
    expectTypeOf<Channel>().not.toExtend<ServerResponseData>();
  });

  it("ChatMessage does NOT extend ServerResponseData", () => {
    expectTypeOf<ChatMessage>().not.toExtend<ServerResponseData>();
  });

  it("BoardMessage does NOT extend ServerResponseData", () => {
    expectTypeOf<BoardMessage>().not.toExtend<ServerResponseData>();
  });

  it("Note does NOT extend ServerResponseData", () => {
    expectTypeOf<Note>().not.toExtend<ServerResponseData>();
  });

  it("ClientFieldDefinition does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientFieldDefinition>().not.toExtend<ServerResponseData>();
  });

  it("ClientFieldValue does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientFieldValue>().not.toExtend<ServerResponseData>();
  });

  it("InnerWorldEntity does NOT extend ServerResponseData", () => {
    expectTypeOf<InnerWorldEntity>().not.toExtend<ServerResponseData>();
  });

  it("InnerWorldRegion does NOT extend ServerResponseData", () => {
    expectTypeOf<InnerWorldRegion>().not.toExtend<ServerResponseData>();
  });

  it("ClientLifecycleEvent does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientLifecycleEvent>().not.toExtend<ServerResponseData>();
  });

  it("ClientCustomFront does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientCustomFront>().not.toExtend<ServerResponseData>();
  });

  it("JournalEntry does NOT extend ServerResponseData", () => {
    expectTypeOf<JournalEntry>().not.toExtend<ServerResponseData>();
  });

  it("WikiPage does NOT extend ServerResponseData", () => {
    expectTypeOf<WikiPage>().not.toExtend<ServerResponseData>();
  });

  it("ClientMemberPhoto does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientMemberPhoto>().not.toExtend<ServerResponseData>();
  });

  it("Poll does NOT extend ServerResponseData", () => {
    expectTypeOf<Poll>().not.toExtend<ServerResponseData>();
  });

  it("PollVote does NOT extend ServerResponseData", () => {
    expectTypeOf<PollVote>().not.toExtend<ServerResponseData>();
  });

  it("AcknowledgementRequest does NOT extend ServerResponseData", () => {
    expectTypeOf<AcknowledgementRequest>().not.toExtend<ServerResponseData>();
  });

  it("TimerConfig does NOT extend ServerResponseData", () => {
    expectTypeOf<TimerConfig>().not.toExtend<ServerResponseData>();
  });

  it("AuditLogEntry does NOT extend ServerResponseData", () => {
    expectTypeOf<AuditLogEntry>().not.toExtend<ServerResponseData>();
  });
});

describe("ServerSafe<T> branding", () => {
  it("ServerSafe<T> is not assignable from unbranded T", () => {
    expectTypeOf<MemberServerMetadata>().not.toExtend<ServerSafe<MemberServerMetadata>>();
  });

  it("ServerSafe<T> extends T (branded is a subtype)", () => {
    expectTypeOf<ServerSafe<MemberServerMetadata>>().toExtend<MemberServerMetadata>();
  });

  it("serverSafe(MemberServerMetadata) returns ServerSafe<MemberServerMetadata>", () => {
    const member = {} as MemberServerMetadata;
    expectTypeOf(serverSafe(member)).toEqualTypeOf<ServerSafe<MemberServerMetadata>>();
  });

  it("serverSafe(MemberServerMetadata[]) returns ServerSafe<readonly MemberServerMetadata[]>", () => {
    const members = [] as MemberServerMetadata[];
    expectTypeOf(serverSafe(members)).toEqualTypeOf<ServerSafe<readonly MemberServerMetadata[]>>();
  });

  it("serverSafe(PaginatedResult<MemberServerMetadata>) returns ServerSafe<PaginatedResult<MemberServerMetadata>>", () => {
    const page = {} as PaginatedResult<MemberServerMetadata>;
    expectTypeOf(serverSafe(page)).toEqualTypeOf<
      ServerSafe<PaginatedResult<MemberServerMetadata>>
    >();
  });
});

describe("serverSafe() — @ts-expect-error rejections", () => {
  it("rejects Member", () => {
    const client = {} as Member;
    // @ts-expect-error Member is not assignable to ServerResponseData
    serverSafe(client);
  });

  it("rejects Member[]", () => {
    const clients = [] as Member[];
    // @ts-expect-error Member[] is not assignable to readonly ServerResponseData[]
    serverSafe(clients);
  });

  it("rejects PaginatedResult<Member>", () => {
    const page = {} as PaginatedResult<Member>;
    // @ts-expect-error PaginatedResult<Member> not assignable
    serverSafe(page);
  });
});

describe("serverSafe() — runtime identity", () => {
  it("is an identity function (returns its argument unchanged)", () => {
    const member = {} as MemberServerMetadata;
    const result = serverSafe(member);
    expect(result).toBe(member);
  });
});
