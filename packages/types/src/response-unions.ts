// Cross-entity response unions aggregating server-visible and client-side
// entity shapes. Consumers typically use these as constraint types on
// generic encryption/decryption helpers.

import type {
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
} from "./encryption-primitives.js";
import type {
  AcknowledgementRequest,
  AcknowledgementRequestServerMetadata,
} from "./entities/acknowledgement.js";
import type { AuditLogEntry, AuditLogEntryServerMetadata } from "./entities/audit-log-entry.js";
import type { BoardMessage, BoardMessageServerMetadata } from "./entities/board-message.js";
import type { Channel, ChannelServerMetadata } from "./entities/channel.js";
import type { CustomFront } from "./entities/custom-front.js";
import type { FieldDefinition } from "./entities/field-definition.js";
import type { FieldValue } from "./entities/field-value.js";
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
import type { JournalEntry, JournalEntryServerMetadata } from "./entities/journal-entry.js";
import type { LifecycleEvent } from "./entities/lifecycle-event.js";
import type { MemberPhoto } from "./entities/member-photo.js";
import type { Member, MemberServerMetadata } from "./entities/member.js";
import type { ChatMessage, ChatMessageServerMetadata } from "./entities/message.js";
import type { Note, NoteServerMetadata } from "./entities/note.js";
import type { PollVote, PollVoteServerMetadata } from "./entities/poll-vote.js";
import type { Poll, PollServerMetadata } from "./entities/poll.js";
import type { Relationship } from "./entities/relationship.js";
import type { SystemStructureEntityType } from "./entities/structure-entity-type.js";
import type { SystemStructureEntity } from "./entities/structure-entity.js";
import type { TimerConfig, TimerConfigServerMetadata } from "./entities/timer-config.js";
import type { WikiPage, WikiPageServerMetadata } from "./entities/wiki-page.js";

/** Union of all server-side types safe to return from API routes. */
export type ServerResponseData =
  | MemberServerMetadata
  | ServerFrontingSession
  | ServerFrontingComment
  | ServerGroup
  | ServerStructureEntityType
  | ServerStructureEntity
  | ServerRelationship
  | ChannelServerMetadata
  | ChatMessageServerMetadata
  | BoardMessageServerMetadata
  | NoteServerMetadata
  | ServerFieldDefinition
  | ServerFieldValue
  | InnerWorldEntityServerMetadata
  | InnerWorldRegionServerMetadata
  | ServerLifecycleEvent
  | ServerCustomFront
  | JournalEntryServerMetadata
  | WikiPageServerMetadata
  | ServerMemberPhoto
  | PollServerMetadata
  | PollVoteServerMetadata
  | AcknowledgementRequestServerMetadata
  | TimerConfigServerMetadata
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
