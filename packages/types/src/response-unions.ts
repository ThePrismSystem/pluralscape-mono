// Cross-entity response unions aggregating server-visible and client-side
// entity shapes. Consumers typically use these as constraint types on
// generic encryption/decryption helpers.

import type {
  ServerAcknowledgementRequest,
  ServerBoardMessage,
  ServerChannel,
  ServerChatMessage,
  ServerCustomFront,
  ServerFrontingComment,
  ServerFrontingSession,
  ServerGroup,
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
} from "./encryption-primitives.js";
import type { AcknowledgementRequest } from "./entities/acknowledgement.js";
import type { AuditLogEntry, AuditLogEntryServerMetadata } from "./entities/audit-log-entry.js";
import type { BoardMessage } from "./entities/board-message.js";
import type { Channel } from "./entities/channel.js";
import type { CustomFront } from "./entities/custom-front.js";
import type {
  FieldDefinition,
  FieldDefinitionServerMetadata,
} from "./entities/field-definition.js";
import type { FieldValue, FieldValueServerMetadata } from "./entities/field-value.js";
import type { FrontingComment } from "./entities/fronting-comment.js";
import type { FrontingSession } from "./entities/fronting-session.js";
import type { Group } from "./entities/group.js";
import type {
  InnerWorldEntity,
  InnerWorldEntityServerMetadata,
} from "./entities/innerworld-entity.js";
import type {
  InnerWorldRegion,
  InnerWorldRegionServerMetadata,
} from "./entities/innerworld-region.js";
import type { JournalEntry } from "./entities/journal-entry.js";
import type { LifecycleEvent } from "./entities/lifecycle-event.js";
import type { MemberPhoto } from "./entities/member-photo.js";
import type { Member, MemberServerMetadata } from "./entities/member.js";
import type { ChatMessage } from "./entities/message.js";
import type { Note } from "./entities/note.js";
import type { PollVote } from "./entities/poll-vote.js";
import type { Poll } from "./entities/poll.js";
import type { Relationship } from "./entities/relationship.js";
import type { SystemStructureEntityType } from "./entities/structure-entity-type.js";
import type { SystemStructureEntity } from "./entities/structure-entity.js";
import type { TimerConfig } from "./entities/timer-config.js";
import type { WikiPage } from "./entities/wiki-page.js";

/** Union of all server-side types safe to return from API routes. */
export type ServerResponseData =
  | MemberServerMetadata
  | ServerFrontingSession
  | ServerFrontingComment
  | ServerGroup
  | ServerStructureEntityType
  | ServerStructureEntity
  | ServerRelationship
  | ServerChannel
  | ServerChatMessage
  | ServerBoardMessage
  | ServerNote
  | FieldDefinitionServerMetadata
  | FieldValueServerMetadata
  | InnerWorldEntityServerMetadata
  | InnerWorldRegionServerMetadata
  | ServerLifecycleEvent
  | ServerCustomFront
  | ServerJournalEntry
  | ServerWikiPage
  | ServerMemberPhoto
  | ServerPoll
  | ServerPollVote
  | ServerAcknowledgementRequest
  | ServerTimerConfig
  | AuditLogEntryServerMetadata;

/** Union of all client-side types that must NEVER appear in API responses. */
export type ClientResponseData =
  | Member
  | FrontingSession
  | FrontingComment
  | Group
  | SystemStructureEntityType
  | SystemStructureEntity
  | Relationship
  | Channel
  | ChatMessage
  | BoardMessage
  | Note
  | FieldDefinition
  | FieldValue
  | InnerWorldEntity
  | InnerWorldRegion
  | LifecycleEvent
  | CustomFront
  | JournalEntry
  | WikiPage
  | MemberPhoto
  | Poll
  | PollVote
  | AcknowledgementRequest
  | TimerConfig
  | AuditLogEntry;
