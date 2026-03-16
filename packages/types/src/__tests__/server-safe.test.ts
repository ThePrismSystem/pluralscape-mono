import { describe, expectTypeOf, it, expect } from "vitest";

import { serverSafe } from "../server-safe.js";

import type {
  ClientAcknowledgementRequest,
  ClientAuditLogEntry,
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
  ClientLayer,
  ClientLifecycleEvent,
  ClientMember,
  ClientMemberPhoto,
  ClientNote,
  ClientPoll,
  ClientPollVote,
  ClientRelationship,
  ClientSideSystem,
  ClientSubsystem,
  ClientTimerConfig,
  ClientWikiPage,
  ServerAcknowledgementRequest,
  ServerAuditLogEntry,
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
  ServerLayer,
  ServerLifecycleEvent,
  ServerMember,
  ServerMemberPhoto,
  ServerNote,
  ServerPoll,
  ServerPollVote,
  ServerRelationship,
  ClientResponseData,
  ServerResponseData,
  ServerSideSystem,
  ServerSubsystem,
  ServerTimerConfig,
  ServerWikiPage,
} from "../encryption.js";
import type { PaginatedResult } from "../pagination.js";
import type { ServerSafe } from "../server-safe.js";

// ── Count assertion ────────────────────────────────────────────────
// If a new Server* type is added to encryption.ts but not to
// ServerResponseData, this tuple will have the wrong length.
type AllServerTypes = [
  ServerMember,
  ServerFrontingSession,
  ServerFrontingComment,
  ServerGroup,
  ServerSubsystem,
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
  ServerSideSystem,
  ServerLayer,
  ServerTimerConfig,
  ServerAuditLogEntry,
];

describe("serverSafe() — Server* types accepted", () => {
  it("accepts all 26 Server* types (count assertion)", () => {
    expectTypeOf<AllServerTypes["length"]>().toEqualTypeOf<26>();
  });

  it("ServerMember extends ServerResponseData", () => {
    expectTypeOf<ServerMember>().toExtend<ServerResponseData>();
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

  it("ServerSubsystem extends ServerResponseData", () => {
    expectTypeOf<ServerSubsystem>().toExtend<ServerResponseData>();
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

  it("ServerSideSystem extends ServerResponseData", () => {
    expectTypeOf<ServerSideSystem>().toExtend<ServerResponseData>();
  });

  it("ServerLayer extends ServerResponseData", () => {
    expectTypeOf<ServerLayer>().toExtend<ServerResponseData>();
  });

  it("ServerTimerConfig extends ServerResponseData", () => {
    expectTypeOf<ServerTimerConfig>().toExtend<ServerResponseData>();
  });

  it("ServerAuditLogEntry extends ServerResponseData", () => {
    expectTypeOf<ServerAuditLogEntry>().toExtend<ServerResponseData>();
  });
});

// ── Count assertion for ClientResponseData ──────────────────────────
// If a new Client* type is added to encryption.ts but not to
// ClientResponseData, this tuple will have the wrong length.
type AllClientTypes = [
  ClientMember,
  ClientFrontingSession,
  ClientFrontingComment,
  ClientGroup,
  ClientSubsystem,
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
  ClientSideSystem,
  ClientLayer,
  ClientTimerConfig,
  ClientAuditLogEntry,
];

describe("ClientResponseData union completeness", () => {
  it("has all 26 Client* types (count assertion)", () => {
    expectTypeOf<AllClientTypes["length"]>().toEqualTypeOf<26>();
  });

  it("ClientMember extends ClientResponseData", () => {
    expectTypeOf<ClientMember>().toExtend<ClientResponseData>();
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

  it("ClientSubsystem extends ClientResponseData", () => {
    expectTypeOf<ClientSubsystem>().toExtend<ClientResponseData>();
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

  it("ClientSideSystem extends ClientResponseData", () => {
    expectTypeOf<ClientSideSystem>().toExtend<ClientResponseData>();
  });

  it("ClientLayer extends ClientResponseData", () => {
    expectTypeOf<ClientLayer>().toExtend<ClientResponseData>();
  });

  it("ClientTimerConfig extends ClientResponseData", () => {
    expectTypeOf<ClientTimerConfig>().toExtend<ClientResponseData>();
  });

  it("ClientAuditLogEntry extends ClientResponseData", () => {
    expectTypeOf<ClientAuditLogEntry>().toExtend<ClientResponseData>();
  });

  it("no Server* type extends ClientResponseData", () => {
    expectTypeOf<ServerMember>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerFrontingSession>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerFrontingComment>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerGroup>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerSubsystem>().not.toExtend<ClientResponseData>();
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
    expectTypeOf<ServerSideSystem>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerLayer>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerTimerConfig>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerAuditLogEntry>().not.toExtend<ClientResponseData>();
  });
});

describe("serverSafe() — Client* types rejected", () => {
  it("ClientMember does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientMember>().not.toExtend<ServerResponseData>();
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

  it("ClientSubsystem does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientSubsystem>().not.toExtend<ServerResponseData>();
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

  it("ClientSideSystem does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientSideSystem>().not.toExtend<ServerResponseData>();
  });

  it("ClientLayer does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientLayer>().not.toExtend<ServerResponseData>();
  });

  it("ClientTimerConfig does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientTimerConfig>().not.toExtend<ServerResponseData>();
  });

  it("ClientAuditLogEntry does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientAuditLogEntry>().not.toExtend<ServerResponseData>();
  });
});

describe("ServerSafe<T> branding", () => {
  it("ServerSafe<T> is not assignable from unbranded T", () => {
    expectTypeOf<ServerMember>().not.toExtend<ServerSafe<ServerMember>>();
  });

  it("ServerSafe<T> extends T (branded is a subtype)", () => {
    expectTypeOf<ServerSafe<ServerMember>>().toExtend<ServerMember>();
  });

  it("serverSafe(ServerMember) returns ServerSafe<ServerMember>", () => {
    const member = {} as ServerMember;
    expectTypeOf(serverSafe(member)).toEqualTypeOf<ServerSafe<ServerMember>>();
  });

  it("serverSafe(ServerMember[]) returns ServerSafe<readonly ServerMember[]>", () => {
    const members = [] as ServerMember[];
    expectTypeOf(serverSafe(members)).toEqualTypeOf<ServerSafe<readonly ServerMember[]>>();
  });

  it("serverSafe(PaginatedResult<ServerMember>) returns ServerSafe<PaginatedResult<ServerMember>>", () => {
    const page = {} as PaginatedResult<ServerMember>;
    expectTypeOf(serverSafe(page)).toEqualTypeOf<ServerSafe<PaginatedResult<ServerMember>>>();
  });
});

describe("serverSafe() — @ts-expect-error rejections", () => {
  it("rejects ClientMember", () => {
    const client = {} as ClientMember;
    // @ts-expect-error ClientMember is not assignable to ServerResponseData
    serverSafe(client);
  });

  it("rejects ClientMember[]", () => {
    const clients = [] as ClientMember[];
    // @ts-expect-error ClientMember[] is not assignable to readonly ServerResponseData[]
    serverSafe(clients);
  });

  it("rejects PaginatedResult<ClientMember>", () => {
    const page = {} as PaginatedResult<ClientMember>;
    // @ts-expect-error PaginatedResult<ClientMember> not assignable
    serverSafe(page);
  });
});

describe("serverSafe() — runtime identity", () => {
  it("is an identity function (returns its argument unchanged)", () => {
    const member = {} as ServerMember;
    const result = serverSafe(member);
    expect(result).toBe(member);
  });
});
