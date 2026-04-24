import { describe, expectTypeOf, it, expect } from "vitest";

import { serverSafe } from "../server-safe.js";

import type {
  AcknowledgementRequest,
  AcknowledgementRequestServerMetadata,
} from "../entities/acknowledgement.js";
import type { AuditLogEntry, AuditLogEntryServerMetadata } from "../entities/audit-log-entry.js";
import type { BoardMessage, BoardMessageServerMetadata } from "../entities/board-message.js";
import type { Channel, ChannelServerMetadata } from "../entities/channel.js";
import type { CustomFront, CustomFrontServerMetadata } from "../entities/custom-front.js";
import type {
  FieldDefinition,
  FieldDefinitionServerMetadata,
} from "../entities/field-definition.js";
import type { FieldValue, FieldValueServerMetadata } from "../entities/field-value.js";
import type {
  FrontingComment,
  FrontingCommentServerMetadata,
} from "../entities/fronting-comment.js";
import type {
  FrontingSession,
  FrontingSessionServerMetadata,
} from "../entities/fronting-session.js";
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
import type { Member, MemberServerMetadata } from "../entities/member.js";
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
import type { PaginatedResult } from "../pagination.js";
import type { ClientResponseData, ServerResponseData } from "../response-unions.js";
import type { ServerSafe } from "../server-safe.js";

// ── Count assertion ────────────────────────────────────────────────
// If a new Server*Metadata type is added but not to ServerResponseData, this
// tuple will have the wrong length.
type AllServerTypes = [
  MemberServerMetadata,
  FrontingSessionServerMetadata,
  FrontingCommentServerMetadata,
  GroupServerMetadata,
  SystemStructureEntityTypeServerMetadata,
  SystemStructureEntityServerMetadata,
  RelationshipServerMetadata,
  ChannelServerMetadata,
  ChatMessageServerMetadata,
  BoardMessageServerMetadata,
  NoteServerMetadata,
  FieldDefinitionServerMetadata,
  FieldValueServerMetadata,
  InnerWorldEntityServerMetadata,
  InnerWorldRegionServerMetadata,
  LifecycleEventServerMetadata,
  CustomFrontServerMetadata,
  JournalEntryServerMetadata,
  WikiPageServerMetadata,
  MemberPhotoServerMetadata,
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

  it("FrontingSessionServerMetadata extends ServerResponseData", () => {
    expectTypeOf<FrontingSessionServerMetadata>().toExtend<ServerResponseData>();
  });

  it("FrontingCommentServerMetadata extends ServerResponseData", () => {
    expectTypeOf<FrontingCommentServerMetadata>().toExtend<ServerResponseData>();
  });

  it("GroupServerMetadata extends ServerResponseData", () => {
    expectTypeOf<GroupServerMetadata>().toExtend<ServerResponseData>();
  });

  it("SystemStructureEntityTypeServerMetadata extends ServerResponseData", () => {
    expectTypeOf<SystemStructureEntityTypeServerMetadata>().toExtend<ServerResponseData>();
  });

  it("SystemStructureEntityServerMetadata extends ServerResponseData", () => {
    expectTypeOf<SystemStructureEntityServerMetadata>().toExtend<ServerResponseData>();
  });

  it("RelationshipServerMetadata extends ServerResponseData", () => {
    expectTypeOf<RelationshipServerMetadata>().toExtend<ServerResponseData>();
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

  it("FieldDefinitionServerMetadata extends ServerResponseData", () => {
    expectTypeOf<FieldDefinitionServerMetadata>().toExtend<ServerResponseData>();
  });

  it("FieldValueServerMetadata extends ServerResponseData", () => {
    expectTypeOf<FieldValueServerMetadata>().toExtend<ServerResponseData>();
  });

  it("InnerWorldEntityServerMetadata extends ServerResponseData", () => {
    expectTypeOf<InnerWorldEntityServerMetadata>().toExtend<ServerResponseData>();
  });

  it("InnerWorldRegionServerMetadata extends ServerResponseData", () => {
    expectTypeOf<InnerWorldRegionServerMetadata>().toExtend<ServerResponseData>();
  });

  it("LifecycleEventServerMetadata extends ServerResponseData", () => {
    expectTypeOf<LifecycleEventServerMetadata>().toExtend<ServerResponseData>();
  });

  it("CustomFrontServerMetadata extends ServerResponseData", () => {
    expectTypeOf<CustomFrontServerMetadata>().toExtend<ServerResponseData>();
  });

  it("JournalEntryServerMetadata extends ServerResponseData", () => {
    expectTypeOf<JournalEntryServerMetadata>().toExtend<ServerResponseData>();
  });

  it("WikiPageServerMetadata extends ServerResponseData", () => {
    expectTypeOf<WikiPageServerMetadata>().toExtend<ServerResponseData>();
  });

  it("MemberPhotoServerMetadata extends ServerResponseData", () => {
    expectTypeOf<MemberPhotoServerMetadata>().toExtend<ServerResponseData>();
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
  FrontingSession,
  FrontingComment,
  Group,
  SystemStructureEntityType,
  SystemStructureEntity,
  Relationship,
  Channel,
  ChatMessage,
  BoardMessage,
  Note,
  FieldDefinition,
  FieldValue,
  InnerWorldEntity,
  InnerWorldRegion,
  LifecycleEvent,
  CustomFront,
  JournalEntry,
  WikiPage,
  MemberPhoto,
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

  it("FrontingSession (domain) extends ClientResponseData", () => {
    expectTypeOf<FrontingSession>().toExtend<ClientResponseData>();
  });

  it("FrontingComment (domain) extends ClientResponseData", () => {
    expectTypeOf<FrontingComment>().toExtend<ClientResponseData>();
  });

  it("Group extends ClientResponseData", () => {
    expectTypeOf<Group>().toExtend<ClientResponseData>();
  });

  it("SystemStructureEntityType extends ClientResponseData", () => {
    expectTypeOf<SystemStructureEntityType>().toExtend<ClientResponseData>();
  });

  it("SystemStructureEntity extends ClientResponseData", () => {
    expectTypeOf<SystemStructureEntity>().toExtend<ClientResponseData>();
  });

  it("Relationship extends ClientResponseData", () => {
    expectTypeOf<Relationship>().toExtend<ClientResponseData>();
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

  it("FieldDefinition extends ClientResponseData", () => {
    expectTypeOf<FieldDefinition>().toExtend<ClientResponseData>();
  });

  it("FieldValue extends ClientResponseData", () => {
    expectTypeOf<FieldValue>().toExtend<ClientResponseData>();
  });

  it("InnerWorldEntity extends ClientResponseData", () => {
    expectTypeOf<InnerWorldEntity>().toExtend<ClientResponseData>();
  });

  it("InnerWorldRegion extends ClientResponseData", () => {
    expectTypeOf<InnerWorldRegion>().toExtend<ClientResponseData>();
  });

  it("LifecycleEvent extends ClientResponseData", () => {
    expectTypeOf<LifecycleEvent>().toExtend<ClientResponseData>();
  });

  it("CustomFront extends ClientResponseData", () => {
    expectTypeOf<CustomFront>().toExtend<ClientResponseData>();
  });

  it("JournalEntry extends ClientResponseData", () => {
    expectTypeOf<JournalEntry>().toExtend<ClientResponseData>();
  });

  it("WikiPage extends ClientResponseData", () => {
    expectTypeOf<WikiPage>().toExtend<ClientResponseData>();
  });

  it("MemberPhoto extends ClientResponseData", () => {
    expectTypeOf<MemberPhoto>().toExtend<ClientResponseData>();
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
    expectTypeOf<FrontingSessionServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<FrontingCommentServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<GroupServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<SystemStructureEntityTypeServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<SystemStructureEntityServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<RelationshipServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<ChannelServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<ChatMessageServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<BoardMessageServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<NoteServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<FieldDefinitionServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<FieldValueServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<InnerWorldEntityServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<InnerWorldRegionServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<LifecycleEventServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<CustomFrontServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<JournalEntryServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<WikiPageServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<MemberPhotoServerMetadata>().not.toExtend<ClientResponseData>();
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

  it("FrontingSession (domain) does NOT extend ServerResponseData", () => {
    expectTypeOf<FrontingSession>().not.toExtend<ServerResponseData>();
  });

  it("FrontingComment (domain) does NOT extend ServerResponseData", () => {
    expectTypeOf<FrontingComment>().not.toExtend<ServerResponseData>();
  });

  it("Group does NOT extend ServerResponseData", () => {
    expectTypeOf<Group>().not.toExtend<ServerResponseData>();
  });

  it("SystemStructureEntityType does NOT extend ServerResponseData", () => {
    expectTypeOf<SystemStructureEntityType>().not.toExtend<ServerResponseData>();
  });

  it("SystemStructureEntity does NOT extend ServerResponseData", () => {
    expectTypeOf<SystemStructureEntity>().not.toExtend<ServerResponseData>();
  });

  it("Relationship does NOT extend ServerResponseData", () => {
    expectTypeOf<Relationship>().not.toExtend<ServerResponseData>();
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

  it("FieldDefinition does NOT extend ServerResponseData", () => {
    expectTypeOf<FieldDefinition>().not.toExtend<ServerResponseData>();
  });

  it("FieldValue does NOT extend ServerResponseData", () => {
    expectTypeOf<FieldValue>().not.toExtend<ServerResponseData>();
  });

  it("InnerWorldEntity does NOT extend ServerResponseData", () => {
    expectTypeOf<InnerWorldEntity>().not.toExtend<ServerResponseData>();
  });

  it("InnerWorldRegion does NOT extend ServerResponseData", () => {
    expectTypeOf<InnerWorldRegion>().not.toExtend<ServerResponseData>();
  });

  it("LifecycleEvent does NOT extend ServerResponseData", () => {
    expectTypeOf<LifecycleEvent>().not.toExtend<ServerResponseData>();
  });

  it("CustomFront does NOT extend ServerResponseData", () => {
    expectTypeOf<CustomFront>().not.toExtend<ServerResponseData>();
  });

  it("JournalEntry does NOT extend ServerResponseData", () => {
    expectTypeOf<JournalEntry>().not.toExtend<ServerResponseData>();
  });

  it("WikiPage does NOT extend ServerResponseData", () => {
    expectTypeOf<WikiPage>().not.toExtend<ServerResponseData>();
  });

  it("MemberPhoto does NOT extend ServerResponseData", () => {
    expectTypeOf<MemberPhoto>().not.toExtend<ServerResponseData>();
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
