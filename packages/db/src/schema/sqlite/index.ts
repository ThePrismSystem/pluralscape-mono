export { accounts, authKeys, deviceTransferRequests, recoveryKeys, sessions } from "./auth.js";
export { apiKeys } from "./api-keys.js";
export { auditLog } from "./audit-log.js";
export {
  acknowledgements,
  boardMessages,
  channels,
  messages,
  notes,
  polls,
  pollVotes,
} from "./communication.js";
export { fieldBucketVisibility, fieldDefinitions, fieldValues } from "./custom-fields.js";
export { customFronts, frontingComments, frontingSessions, switches } from "./fronting.js";
export { groupMemberships, groups } from "./groups.js";
export { innerworldCanvas, innerworldEntities, innerworldRegions } from "./innerworld.js";
export { journalEntries, wikiPages } from "./journal.js";
export { lifecycleEvents } from "./lifecycle-events.js";
export { members, memberPhotos } from "./members.js";
export { nomenclatureSettings } from "./nomenclature-settings.js";
export {
  deviceTokens,
  friendNotificationPreferences,
  notificationConfigs,
} from "./notifications.js";
export { pkBridgeState } from "./pk-bridge.js";
export {
  bucketContentTags,
  buckets,
  friendBucketAssignments,
  friendCodes,
  friendConnections,
  keyGrants,
} from "./privacy.js";
export { safeModeContent } from "./safe-mode-content.js";
export {
  layerMemberships,
  layers,
  relationships,
  sideSystemLayerLinks,
  sideSystemMemberships,
  sideSystems,
  subsystemLayerLinks,
  subsystemMemberships,
  subsystemSideSystemLinks,
  subsystems,
} from "./structure.js";
export { blobMetadata } from "./blob-metadata.js";
export { systemSettings } from "./system-settings.js";
export { systems } from "./systems.js";
export { checkInRecords, timerConfigs } from "./timers.js";
export { webhookConfigs, webhookDeliveries } from "./webhooks.js";
export { importJobs, exportRequests, accountPurgeRequests } from "./import-export.js";
export { syncDocuments, syncQueue, syncConflicts } from "./sync.js";
export {
  SEARCH_INDEX_DDL,
  createSearchIndex,
  dropSearchIndex,
  insertSearchEntry,
  deleteSearchEntry,
  rebuildSearchIndex,
  searchEntries,
} from "./search.js";
export type { SearchIndexEntry, SearchIndexResult, SearchOptions } from "./search.js";
export { jobs } from "./jobs.js";

import type { apiKeys } from "./api-keys.js";
import type { auditLog } from "./audit-log.js";
import type { accounts, authKeys, deviceTransferRequests, recoveryKeys, sessions } from "./auth.js";
import type { blobMetadata } from "./blob-metadata.js";
import type {
  acknowledgements,
  boardMessages,
  channels,
  messages,
  notes,
  polls,
  pollVotes,
} from "./communication.js";
import type { fieldBucketVisibility, fieldDefinitions, fieldValues } from "./custom-fields.js";
import type { customFronts, frontingComments, frontingSessions, switches } from "./fronting.js";
import type { groupMemberships, groups } from "./groups.js";
import type { accountPurgeRequests, exportRequests, importJobs } from "./import-export.js";
import type { innerworldCanvas, innerworldEntities, innerworldRegions } from "./innerworld.js";
import type { jobs } from "./jobs.js";
import type { journalEntries, wikiPages } from "./journal.js";
import type { lifecycleEvents } from "./lifecycle-events.js";
import type { members, memberPhotos } from "./members.js";
import type { nomenclatureSettings } from "./nomenclature-settings.js";
import type {
  deviceTokens,
  friendNotificationPreferences,
  notificationConfigs,
} from "./notifications.js";
import type { pkBridgeState } from "./pk-bridge.js";
import type {
  bucketContentTags,
  buckets,
  friendBucketAssignments,
  friendCodes,
  friendConnections,
  keyGrants,
} from "./privacy.js";
import type { safeModeContent } from "./safe-mode-content.js";
import type {
  layerMemberships,
  layers,
  relationships,
  sideSystemLayerLinks,
  sideSystemMemberships,
  sideSystems,
  subsystemLayerLinks,
  subsystemMemberships,
  subsystemSideSystemLinks,
  subsystems,
} from "./structure.js";
import type { syncConflicts, syncDocuments, syncQueue } from "./sync.js";
import type { systemSettings } from "./system-settings.js";
import type { systems } from "./systems.js";
import type { checkInRecords, timerConfigs } from "./timers.js";
import type { webhookConfigs, webhookDeliveries } from "./webhooks.js";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Inferred row types
export type AccountRow = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;
export type AuthKeyRow = InferSelectModel<typeof authKeys>;
export type NewAuthKey = InferInsertModel<typeof authKeys>;
export type SessionRow = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type RecoveryKeyRow = InferSelectModel<typeof recoveryKeys>;
export type NewRecoveryKey = InferInsertModel<typeof recoveryKeys>;
export type DeviceTransferRequestRow = InferSelectModel<typeof deviceTransferRequests>;
export type NewDeviceTransferRequest = InferInsertModel<typeof deviceTransferRequests>;
export type SystemRow = InferSelectModel<typeof systems>;
export type NewSystem = InferInsertModel<typeof systems>;
export type MemberRow = InferSelectModel<typeof members>;
export type NewMember = InferInsertModel<typeof members>;
export type MemberPhotoRow = InferSelectModel<typeof memberPhotos>;
export type NewMemberPhoto = InferInsertModel<typeof memberPhotos>;

// Privacy
export type BucketRow = InferSelectModel<typeof buckets>;
export type NewBucket = InferInsertModel<typeof buckets>;
export type BucketContentTagRow = InferSelectModel<typeof bucketContentTags>;
export type NewBucketContentTag = InferInsertModel<typeof bucketContentTags>;
export type KeyGrantRow = InferSelectModel<typeof keyGrants>;
export type NewKeyGrant = InferInsertModel<typeof keyGrants>;
export type FriendConnectionRow = InferSelectModel<typeof friendConnections>;
export type NewFriendConnection = InferInsertModel<typeof friendConnections>;
export type FriendCodeRow = InferSelectModel<typeof friendCodes>;
export type NewFriendCode = InferInsertModel<typeof friendCodes>;
export type FriendBucketAssignmentRow = InferSelectModel<typeof friendBucketAssignments>;
export type NewFriendBucketAssignment = InferInsertModel<typeof friendBucketAssignments>;

// Fronting
export type FrontingSessionRow = InferSelectModel<typeof frontingSessions>;
export type NewFrontingSession = InferInsertModel<typeof frontingSessions>;
export type SwitchRow = InferSelectModel<typeof switches>;
export type NewSwitch = InferInsertModel<typeof switches>;
export type CustomFrontRow = InferSelectModel<typeof customFronts>;
export type NewCustomFront = InferInsertModel<typeof customFronts>;
export type FrontingCommentRow = InferSelectModel<typeof frontingComments>;
export type NewFrontingComment = InferInsertModel<typeof frontingComments>;

// Structure
export type RelationshipRow = InferSelectModel<typeof relationships>;
export type NewRelationship = InferInsertModel<typeof relationships>;
export type SubsystemRow = InferSelectModel<typeof subsystems>;
export type NewSubsystem = InferInsertModel<typeof subsystems>;
export type SideSystemRow = InferSelectModel<typeof sideSystems>;
export type NewSideSystem = InferInsertModel<typeof sideSystems>;
export type LayerRow = InferSelectModel<typeof layers>;
export type NewLayer = InferInsertModel<typeof layers>;
export type SubsystemMembershipRow = InferSelectModel<typeof subsystemMemberships>;
export type NewSubsystemMembership = InferInsertModel<typeof subsystemMemberships>;
export type SideSystemMembershipRow = InferSelectModel<typeof sideSystemMemberships>;
export type NewSideSystemMembership = InferInsertModel<typeof sideSystemMemberships>;
export type LayerMembershipRow = InferSelectModel<typeof layerMemberships>;
export type NewLayerMembership = InferInsertModel<typeof layerMemberships>;
export type SubsystemLayerLinkRow = InferSelectModel<typeof subsystemLayerLinks>;
export type NewSubsystemLayerLink = InferInsertModel<typeof subsystemLayerLinks>;
export type SubsystemSideSystemLinkRow = InferSelectModel<typeof subsystemSideSystemLinks>;
export type NewSubsystemSideSystemLink = InferInsertModel<typeof subsystemSideSystemLinks>;
export type SideSystemLayerLinkRow = InferSelectModel<typeof sideSystemLayerLinks>;
export type NewSideSystemLayerLink = InferInsertModel<typeof sideSystemLayerLinks>;

// Custom Fields
export type FieldDefinitionRow = InferSelectModel<typeof fieldDefinitions>;
export type NewFieldDefinition = InferInsertModel<typeof fieldDefinitions>;
export type FieldValueRow = InferSelectModel<typeof fieldValues>;
export type NewFieldValue = InferInsertModel<typeof fieldValues>;
export type FieldBucketVisibilityRow = InferSelectModel<typeof fieldBucketVisibility>;
export type NewFieldBucketVisibility = InferInsertModel<typeof fieldBucketVisibility>;

// Config & Settings
export type NomenclatureSettingsRow = InferSelectModel<typeof nomenclatureSettings>;
export type NewNomenclatureSettings = InferInsertModel<typeof nomenclatureSettings>;
export type SystemSettingsRow = InferSelectModel<typeof systemSettings>;
export type NewSystemSettings = InferInsertModel<typeof systemSettings>;

// API Keys
export type ApiKeyRow = InferSelectModel<typeof apiKeys>;
export type NewApiKey = InferInsertModel<typeof apiKeys>;

// Audit & Lifecycle
export type AuditLogRow = InferSelectModel<typeof auditLog>;
export type NewAuditLog = InferInsertModel<typeof auditLog>;
export type LifecycleEventRow = InferSelectModel<typeof lifecycleEvents>;
export type NewLifecycleEvent = InferInsertModel<typeof lifecycleEvents>;

// Safe Mode
export type SafeModeContentRow = InferSelectModel<typeof safeModeContent>;
export type NewSafeModeContent = InferInsertModel<typeof safeModeContent>;

// Communication
export type ChannelRow = InferSelectModel<typeof channels>;
export type NewChannel = InferInsertModel<typeof channels>;
export type MessageRow = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;
export type BoardMessageRow = InferSelectModel<typeof boardMessages>;
export type NewBoardMessage = InferInsertModel<typeof boardMessages>;
export type NoteRow = InferSelectModel<typeof notes>;
export type NewNote = InferInsertModel<typeof notes>;
export type PollRow = InferSelectModel<typeof polls>;
export type NewPoll = InferInsertModel<typeof polls>;
export type PollVoteRow = InferSelectModel<typeof pollVotes>;
export type NewPollVote = InferInsertModel<typeof pollVotes>;
export type AcknowledgementRow = InferSelectModel<typeof acknowledgements>;
export type NewAcknowledgement = InferInsertModel<typeof acknowledgements>;

// Journal
export type JournalEntryRow = InferSelectModel<typeof journalEntries>;
export type NewJournalEntry = InferInsertModel<typeof journalEntries>;
export type WikiPageRow = InferSelectModel<typeof wikiPages>;
export type NewWikiPage = InferInsertModel<typeof wikiPages>;

// Groups
export type GroupRow = InferSelectModel<typeof groups>;
export type NewGroup = InferInsertModel<typeof groups>;
export type GroupMembershipRow = InferSelectModel<typeof groupMemberships>;
export type NewGroupMembership = InferInsertModel<typeof groupMemberships>;

// Innerworld
export type InnerworldRegionRow = InferSelectModel<typeof innerworldRegions>;
export type NewInnerworldRegion = InferInsertModel<typeof innerworldRegions>;
export type InnerworldEntityRow = InferSelectModel<typeof innerworldEntities>;
export type NewInnerworldEntity = InferInsertModel<typeof innerworldEntities>;
export type InnerworldCanvasRow = InferSelectModel<typeof innerworldCanvas>;
export type NewInnerworldCanvas = InferInsertModel<typeof innerworldCanvas>;

// PK Bridge
export type PkBridgeStateRow = InferSelectModel<typeof pkBridgeState>;
export type NewPkBridgeState = InferInsertModel<typeof pkBridgeState>;

// Notifications
export type DeviceTokenRow = InferSelectModel<typeof deviceTokens>;
export type NewDeviceToken = InferInsertModel<typeof deviceTokens>;
export type NotificationConfigRow = InferSelectModel<typeof notificationConfigs>;
export type NewNotificationConfig = InferInsertModel<typeof notificationConfigs>;
export type FriendNotificationPreferenceRow = InferSelectModel<
  typeof friendNotificationPreferences
>;
export type NewFriendNotificationPreference = InferInsertModel<
  typeof friendNotificationPreferences
>;

// Webhooks
export type WebhookConfigRow = InferSelectModel<typeof webhookConfigs>;
export type NewWebhookConfig = InferInsertModel<typeof webhookConfigs>;
export type WebhookDeliveryRow = InferSelectModel<typeof webhookDeliveries>;
export type NewWebhookDelivery = InferInsertModel<typeof webhookDeliveries>;

// Blob Metadata
export type BlobMetadataRow = InferSelectModel<typeof blobMetadata>;
export type NewBlobMetadata = InferInsertModel<typeof blobMetadata>;

// Timers
export type TimerConfigRow = InferSelectModel<typeof timerConfigs>;
export type NewTimerConfig = InferInsertModel<typeof timerConfigs>;
export type CheckInRecordRow = InferSelectModel<typeof checkInRecords>;
export type NewCheckInRecord = InferInsertModel<typeof checkInRecords>;

// Import/Export
export type ImportJobRow = InferSelectModel<typeof importJobs>;
export type NewImportJob = InferInsertModel<typeof importJobs>;
export type ExportRequestRow = InferSelectModel<typeof exportRequests>;
export type NewExportRequest = InferInsertModel<typeof exportRequests>;
export type AccountPurgeRequestRow = InferSelectModel<typeof accountPurgeRequests>;
export type NewAccountPurgeRequest = InferInsertModel<typeof accountPurgeRequests>;

// Sync
export type SyncDocumentRow = InferSelectModel<typeof syncDocuments>;
export type NewSyncDocument = InferInsertModel<typeof syncDocuments>;
export type SyncQueueRow = InferSelectModel<typeof syncQueue>;
export type NewSyncQueue = InferInsertModel<typeof syncQueue>;
export type SyncConflictRow = InferSelectModel<typeof syncConflicts>;
export type NewSyncConflict = InferInsertModel<typeof syncConflicts>;

// Jobs
export type JobRow = InferSelectModel<typeof jobs>;
export type NewJob = InferInsertModel<typeof jobs>;
