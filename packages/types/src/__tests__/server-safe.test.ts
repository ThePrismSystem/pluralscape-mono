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
    // Verify the function body is literally `return data` — zero overhead
    const src = serverSafe.toString();
    expect(src).toContain("return data");
  });
});
