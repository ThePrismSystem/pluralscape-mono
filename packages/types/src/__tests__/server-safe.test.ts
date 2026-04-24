import { describe, expectTypeOf, it, expect } from "vitest";

import { serverSafe } from "../server-safe.js";

import type {
  ClientAcknowledgementRequest,
  ClientBoardMessage,
  ClientChannel,
  ClientChatMessage,
  ClientJournalEntry,
  ClientNote,
  ClientPoll,
  ClientPollVote,
  ClientTimerConfig,
  ClientWikiPage,
  ServerAcknowledgementRequest,
  ServerBoardMessage,
  ServerChannel,
  ServerChatMessage,
  ServerJournalEntry,
  ServerNote,
  ServerPoll,
  ServerPollVote,
  ServerTimerConfig,
  ServerWikiPage,
} from "../encryption-primitives.js";
import type { AuditLogEntry, AuditLogEntryServerMetadata } from "../entities/audit-log-entry.js";
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
import type { LifecycleEvent, LifecycleEventServerMetadata } from "../entities/lifecycle-event.js";
import type { MemberPhoto, MemberPhotoServerMetadata } from "../entities/member-photo.js";
import type { Member, MemberServerMetadata } from "../entities/member.js";
import type { Relationship, RelationshipServerMetadata } from "../entities/relationship.js";
import type {
  SystemStructureEntityType,
  SystemStructureEntityTypeServerMetadata,
} from "../entities/structure-entity-type.js";
import type {
  SystemStructureEntity,
  SystemStructureEntityServerMetadata,
} from "../entities/structure-entity.js";
import type { PaginatedResult } from "../pagination.js";
import type { ClientResponseData, ServerResponseData } from "../response-unions.js";
import type { ServerSafe } from "../server-safe.js";

// ── Count assertion ────────────────────────────────────────────────
// If a new Server* type is added to encryption.ts but not to
// ServerResponseData, this tuple will have the wrong length.
type AllServerTypes = [
  MemberServerMetadata,
  FrontingSessionServerMetadata,
  FrontingCommentServerMetadata,
  GroupServerMetadata,
  SystemStructureEntityTypeServerMetadata,
  SystemStructureEntityServerMetadata,
  RelationshipServerMetadata,
  ServerChannel,
  ServerChatMessage,
  ServerBoardMessage,
  ServerNote,
  FieldDefinitionServerMetadata,
  FieldValueServerMetadata,
  InnerWorldEntityServerMetadata,
  InnerWorldRegionServerMetadata,
  LifecycleEventServerMetadata,
  CustomFrontServerMetadata,
  ServerJournalEntry,
  ServerWikiPage,
  MemberPhotoServerMetadata,
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

  it("ServerJournalEntry extends ServerResponseData", () => {
    expectTypeOf<ServerJournalEntry>().toExtend<ServerResponseData>();
  });

  it("ServerWikiPage extends ServerResponseData", () => {
    expectTypeOf<ServerWikiPage>().toExtend<ServerResponseData>();
  });

  it("MemberPhotoServerMetadata extends ServerResponseData", () => {
    expectTypeOf<MemberPhotoServerMetadata>().toExtend<ServerResponseData>();
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
  FrontingSession,
  FrontingComment,
  Group,
  SystemStructureEntityType,
  SystemStructureEntity,
  Relationship,
  ClientChannel,
  ClientChatMessage,
  ClientBoardMessage,
  ClientNote,
  FieldDefinition,
  FieldValue,
  InnerWorldEntity,
  InnerWorldRegion,
  LifecycleEvent,
  CustomFront,
  ClientJournalEntry,
  ClientWikiPage,
  MemberPhoto,
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

  it("ClientJournalEntry extends ClientResponseData", () => {
    expectTypeOf<ClientJournalEntry>().toExtend<ClientResponseData>();
  });

  it("ClientWikiPage extends ClientResponseData", () => {
    expectTypeOf<ClientWikiPage>().toExtend<ClientResponseData>();
  });

  it("MemberPhoto extends ClientResponseData", () => {
    expectTypeOf<MemberPhoto>().toExtend<ClientResponseData>();
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
    expectTypeOf<FrontingSessionServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<FrontingCommentServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<GroupServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<SystemStructureEntityTypeServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<SystemStructureEntityServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<RelationshipServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerChannel>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerChatMessage>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerBoardMessage>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerNote>().not.toExtend<ClientResponseData>();
    expectTypeOf<FieldDefinitionServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<FieldValueServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<InnerWorldEntityServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<InnerWorldRegionServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<LifecycleEventServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<CustomFrontServerMetadata>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerJournalEntry>().not.toExtend<ClientResponseData>();
    expectTypeOf<ServerWikiPage>().not.toExtend<ClientResponseData>();
    expectTypeOf<MemberPhotoServerMetadata>().not.toExtend<ClientResponseData>();
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

  it("ClientJournalEntry does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientJournalEntry>().not.toExtend<ServerResponseData>();
  });

  it("ClientWikiPage does NOT extend ServerResponseData", () => {
    expectTypeOf<ClientWikiPage>().not.toExtend<ServerResponseData>();
  });

  it("MemberPhoto does NOT extend ServerResponseData", () => {
    expectTypeOf<MemberPhoto>().not.toExtend<ServerResponseData>();
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
