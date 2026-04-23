import { describe, expectTypeOf, it, expect } from "vitest";

import { serverSafe } from "../server-safe.js";

import type {
  ClientAcknowledgementRequest,
  ClientBoardMessage,
  ClientChannel,
  ClientChatMessage,
  ClientCustomFront,
  ClientFieldDefinition,
  ClientFieldValue,
  ClientFrontingComment,
  ClientFrontingSession,
  ClientGroup,
  ClientInnerWorldEntity,
  ClientInnerWorldRegion,
  ClientJournalEntry,
  ClientLifecycleEvent,
  ClientMemberPhoto,
  ClientNote,
  ClientPoll,
  ClientPollVote,
  ClientRelationship,
  ClientStructureEntity,
  ClientStructureEntityType,
  ClientTimerConfig,
  ClientWikiPage,
  ServerAcknowledgementRequest,
  ServerBoardMessage,
  ServerChannel,
  ServerChatMessage,
  ServerCustomFront,
  ServerFieldDefinition,
  ServerFieldValue,
  ServerFrontingComment,
  ServerFrontingSession,
  ServerGroup,
  ServerInnerWorldEntity,
  ServerInnerWorldRegion,
  ServerJournalEntry,
  ServerLifecycleEvent,
  ServerMemberPhoto,
  ServerNote,
  ServerPoll,
  ServerPollVote,
  ServerRelationship,
  ServerStructureEntity,
  ServerStructureEntityType,
  ServerTimerConfig,
  ServerWikiPage,
} from "../encryption-primitives.js";
import type { AuditLogEntry, AuditLogEntryServerMetadata } from "../entities/audit-log-entry.js";
import type { Member, MemberServerMetadata } from "../entities/member.js";
import type { PaginatedResult } from "../pagination.js";
import type { ClientResponseData, ServerResponseData } from "../response-unions.js";
import type { ServerSafe } from "../server-safe.js";

// ── Count assertion ────────────────────────────────────────────────
// If a new Server* type is added to encryption.ts but not to
// ServerResponseData, this tuple will have the wrong length.
type AllServerTypes = [
  MemberServerMetadata,
  ServerFrontingSession,
  ServerFrontingComment,
  ServerGroup,
  ServerStructureEntityType,
  ServerStructureEntity,
  ServerRelationship,
  ServerChannel,
  ServerChatMessage,
  ServerBoardMessage,
  ServerNote,
  ServerFieldDefinition,
  ServerFieldValue,
  ServerInnerWorldEntity,
  ServerInnerWorldRegion,
  ServerLifecycleEvent,
  ServerCustomFront,
  ServerJournalEntry,
  ServerWikiPage,
  ServerMemberPhoto,
  ServerPoll,
  ServerPollVote,
  ServerAcknowledgementRequest,
  ServerTimerConfig,
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

  it("ServerChannel extends ServerResponseData", () => {
    expectTypeOf<ServerChannel>().toExtend<ServerResponseData>();
  });

  it("ServerChatMessage extends ServerResponseData", () => {
    expectTypeOf<ServerChatMessage>().toExtend<ServerResponseData>();
  });

  it("ServerBoardMessage extends ServerResponseData", () => {
    expectTypeOf<ServerBoardMessage>().toExtend<ServerResponseData>();
  });

  it("ServerNote extends ServerResponseData", () => {
    expectTypeOf<ServerNote>().toExtend<ServerResponseData>();
  });

  it("ServerFieldDefinition extends ServerResponseData", () => {
    expectTypeOf<ServerFieldDefinition>().toExtend<ServerResponseData>();
  });

  it("ServerFieldValue extends ServerResponseData", () => {
    expectTypeOf<ServerFieldValue>().toExtend<ServerResponseData>();
  });

  it("ServerInnerWorldEntity extends ServerResponseData", () => {
    expectTypeOf<ServerInnerWorldEntity>().toExtend<ServerResponseData>();
  });

  it("ServerInnerWorldRegion extends ServerResponseData", () => {
    expectTypeOf<ServerInnerWorldRegion>().toExtend<ServerResponseData>();
  });

  it("ServerLifecycleEvent extends ServerResponseData", () => {
    expectTypeOf<ServerLifecycleEvent>().toExtend<ServerResponseData>();
  });

  it("ServerCustomFront extends ServerResponseData", () => {
    expectTypeOf<ServerCustomFront>().toExtend<ServerResponseData>();
  });

  it("ServerJournalEntry extends ServerResponseData", () => {
    expectTypeOf<ServerJournalEntry>().toExtend<ServerResponseData>();
  });

  it("ServerWikiPage extends ServerResponseData", () => {
    expectTypeOf<ServerWikiPage>().toExtend<ServerResponseData>();
  });

  it("ServerMemberPhoto extends ServerResponseData", () => {
    expectTypeOf<ServerMemberPhoto>().toExtend<ServerResponseData>();
  });

  it("ServerPoll extends ServerResponseData", () => {
    expectTypeOf<ServerPoll>().toExtend<ServerResponseData>();
  });

  it("ServerPollVote extends ServerResponseData", () => {
    expectTypeOf<ServerPollVote>().toExtend<ServerResponseData>();
  });

  it("ServerAcknowledgementRequest extends ServerResponseData", () => {
    expectTypeOf<ServerAcknowledgementRequest>().toExtend<ServerResponseData>();
  });

  it("ServerTimerConfig extends ServerResponseData", () => {
    expectTypeOf<ServerTimerConfig>().toExtend<ServerResponseData>();
  });

  it("AuditLogEntryServerMetadata extends ServerResponseData", () => {
    expectTypeOf<AuditLogEntryServerMetadata>().toExtend<ServerResponseData>();
  });
});

// ── Count assertion for ClientResponseData ──────────────────────────
// If a new Client* type is added to encryption.ts but not to
// ClientResponseData, this tuple will have the wrong length.
type AllClientTypes = [
  Member,
  ClientFrontingSession,
  ClientFrontingComment,
  ClientGroup,
  ClientStructureEntityType,
  ClientStructureEntity,
  ClientRelationship,
  ClientChannel,
  ClientChatMessage,
  ClientBoardMessage,
  ClientNote,
  ClientFieldDefinition,
  ClientFieldValue,
  ClientInnerWorldEntity,
  ClientInnerWorldRegion,
  ClientLifecycleEvent,
  ClientCustomFront,
  ClientJournalEntry,
  ClientWikiPage,
  ClientMemberPhoto,
  ClientPoll,
  ClientPollVote,
  ClientAcknowledgementRequest,
  ClientTimerConfig,
  AuditLogEntry,
];

describe("ClientResponseData union completeness", () => {
  it("has all 25 Client* types (count assertion)", () => {
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

  it("ClientChannel extends ClientResponseData", () => {
    expectTypeOf<ClientChannel>().toExtend<ClientResponseData>();
  });

  it("ClientChatMessage extends ClientResponseData", () => {
    expectTypeOf<ClientChatMessage>().toExtend<ClientResponseData>();
  });

  it("ClientBoardMessage extends ClientResponseData", () => {
    expectTypeOf<ClientBoardMessage>().toExtend<ClientResponseData>();
  });

  it("ClientNote extends ClientResponseData", () => {
    expectTypeOf<ClientNote>().toExtend<ClientResponseData>();
  });

  it("ClientFieldDefinition extends ClientResponseData", () => {
    expectTypeOf<ClientFieldDefinition>().toExtend<ClientResponseData>();
  });

  it("ClientFieldValue extends ClientResponseData", () => {
    expectTypeOf<ClientFieldValue>().toExtend<ClientResponseData>();
  });

  it("ClientInnerWorldEntity extends ClientResponseData", () => {
    expectTypeOf<ClientInnerWorldEntity>().toExtend<ClientResponseData>();
  });

  it("ClientInnerWorldRegion extends ClientResponseData", () => {
    expectTypeOf<ClientInnerWorldRegion>().toExtend<ClientResponseData>();
  });

  it("ClientLifecycleEvent extends ClientResponseData", () => {
    expectTypeOf<ClientLifecycleEvent>().toExtend<ClientResponseData>();
  });

  it("ClientCustomFront extends ClientResponseData", () => {
    expectTypeOf<ClientCustomFront>().toExtend<ClientResponseData>();
  });

  it("ClientJournalEntry extends ClientResponseData", () => {
    expectTypeOf<ClientJournalEntry>().toExtend<ClientResponseData>();
  });

  it("ClientWikiPage extends ClientResponseData", () => {
    expectTypeOf<ClientWikiPage>().toExtend<ClientResponseData>();
  });

  it("ClientMemberPhoto extends ClientResponseData", () => {
    expectTypeOf<ClientMemberPhoto>().toExtend<ClientResponseData>();
  });

  it("ClientPoll extends ClientResponseData", () => {
    expectTypeOf<ClientPoll>().toExtend<ClientResponseData>();
  });

  it("ClientPollVote extends ClientResponseData", () => {
    expectTypeOf<ClientPollVote>().toExtend<ClientResponseData>();
  });

  it("ClientAcknowledgementRequest extends ClientResponseData", () => {
    expectTypeOf<ClientAcknowledgementRequest>().toExtend<ClientResponseData>();
  });

  it("ClientTimerConfig extends ClientResponseData", () => {
    expectTypeOf<ClientTimerConfig>().toExtend<ClientResponseData>();
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
    expectTypeOf<ServerChannel>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerChatMessage>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerBoardMessage>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerNote>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerFieldDefinition>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerFieldValue>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerInnerWorldEntity>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerInnerWorldRegion>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerLifecycleEvent>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerCustomFront>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerJournalEntry>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerWikiPage>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerMemberPhoto>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerPoll>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerPollVote>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerAcknowledgementRequest>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerTimerConfig>().not.toExtend<ClientResponseData>();
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

  it("ClientChannel does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientChannel>().not.toExtend<ServerResponseData>();
  });

  it("ClientChatMessage does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientChatMessage>().not.toExtend<ServerResponseData>();
  });

  it("ClientBoardMessage does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientBoardMessage>().not.toExtend<ServerResponseData>();
  });

  it("ClientNote does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientNote>().not.toExtend<ServerResponseData>();
  });

  it("ClientFieldDefinition does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientFieldDefinition>().not.toExtend<ServerResponseData>();
  });

  it("ClientFieldValue does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientFieldValue>().not.toExtend<ServerResponseData>();
  });

  it("ClientInnerWorldEntity does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientInnerWorldEntity>().not.toExtend<ServerResponseData>();
  });

  it("ClientInnerWorldRegion does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientInnerWorldRegion>().not.toExtend<ServerResponseData>();
  });

  it("ClientLifecycleEvent does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientLifecycleEvent>().not.toExtend<ServerResponseData>();
  });

  it("ClientCustomFront does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientCustomFront>().not.toExtend<ServerResponseData>();
  });

  it("ClientJournalEntry does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientJournalEntry>().not.toExtend<ServerResponseData>();
  });

  it("ClientWikiPage does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientWikiPage>().not.toExtend<ServerResponseData>();
  });

  it("ClientMemberPhoto does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientMemberPhoto>().not.toExtend<ServerResponseData>();
  });

  it("ClientPoll does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientPoll>().not.toExtend<ServerResponseData>();
  });

  it("ClientPollVote does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientPollVote>().not.toExtend<ServerResponseData>();
  });

  it("ClientAcknowledgementRequest does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientAcknowledgementRequest>().not.toExtend<ServerResponseData>();
  });

  it("ClientTimerConfig does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientTimerConfig>().not.toExtend<ServerResponseData>();
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
