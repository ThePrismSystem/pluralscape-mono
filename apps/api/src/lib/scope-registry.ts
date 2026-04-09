import type { RequiredScope } from "@pluralscape/types";

/** A single scope entry in the registry. */
export interface ScopeEntry {
  readonly scope: RequiredScope;
}

/** Central registry mapping REST routes and tRPC procedures to their required scopes. */
export interface ScopeRegistry {
  /** Keyed by `"METHOD /path/with/:params"` (no `/v1` prefix). */
  readonly rest: ReadonlyMap<string, ScopeEntry>;
  /** Keyed by `"router.procedure"` or `"router.sub.procedure"`. */
  readonly trpc: ReadonlyMap<string, ScopeEntry>;
}

// ---------------------------------------------------------------------------
// REST entries
// ---------------------------------------------------------------------------

const REST_ENTRIES: readonly [string, RequiredScope][] = [
  // Systems
  ["GET /systems/:systemId", "read:system"],
  ["PUT /systems/:systemId", "write:system"],
  ["DELETE /systems/:systemId", "delete:system"],
  ["POST /systems/:systemId/duplicate", "write:system"],
  ["POST /systems/:systemId/purge", "delete:system"],

  // Members
  ["GET /systems/:systemId/members", "read:members"],
  ["POST /systems/:systemId/members", "write:members"],
  ["GET /systems/:systemId/members/:memberId", "read:members"],
  ["PUT /systems/:systemId/members/:memberId", "write:members"],
  ["DELETE /systems/:systemId/members/:memberId", "delete:members"],
  ["POST /systems/:systemId/members/:memberId/archive", "write:members"],
  ["POST /systems/:systemId/members/:memberId/restore", "write:members"],
  ["POST /systems/:systemId/members/:memberId/duplicate", "write:members"],

  // Member Photos
  ["GET /systems/:systemId/members/:memberId/photos", "read:members"],
  ["POST /systems/:systemId/members/:memberId/photos", "write:members"],
  ["GET /systems/:systemId/members/:memberId/photos/:photoId", "read:members"],
  ["DELETE /systems/:systemId/members/:memberId/photos/:photoId", "delete:members"],
  ["POST /systems/:systemId/members/:memberId/photos/:photoId/archive", "write:members"],
  ["POST /systems/:systemId/members/:memberId/photos/:photoId/restore", "write:members"],
  ["PUT /systems/:systemId/members/:memberId/photos/reorder", "write:members"],
  ["GET /systems/:systemId/members/:memberId/memberships", "read:members"],

  // Groups
  ["GET /systems/:systemId/groups", "read:groups"],
  ["POST /systems/:systemId/groups", "write:groups"],
  ["GET /systems/:systemId/groups/:groupId", "read:groups"],
  ["PUT /systems/:systemId/groups/:groupId", "write:groups"],
  ["DELETE /systems/:systemId/groups/:groupId", "delete:groups"],
  ["POST /systems/:systemId/groups/:groupId/archive", "write:groups"],
  ["POST /systems/:systemId/groups/:groupId/restore", "write:groups"],
  ["GET /systems/:systemId/groups/:groupId/members", "read:groups"],
  ["POST /systems/:systemId/groups/:groupId/members", "write:groups"],
  ["DELETE /systems/:systemId/groups/:groupId/members/:memberId", "write:groups"],
  ["POST /systems/:systemId/groups/reorder", "write:groups"],
  ["GET /systems/:systemId/groups/tree", "read:groups"],
  ["POST /systems/:systemId/groups/:groupId/copy", "write:groups"],
  ["POST /systems/:systemId/groups/:groupId/move", "write:groups"],

  // Custom Fronts
  ["GET /systems/:systemId/custom-fronts", "read:fronting"],
  ["POST /systems/:systemId/custom-fronts", "write:fronting"],
  ["GET /systems/:systemId/custom-fronts/:customFrontId", "read:fronting"],
  ["PUT /systems/:systemId/custom-fronts/:customFrontId", "write:fronting"],
  ["DELETE /systems/:systemId/custom-fronts/:customFrontId", "delete:fronting"],
  ["POST /systems/:systemId/custom-fronts/:customFrontId/archive", "write:fronting"],
  ["POST /systems/:systemId/custom-fronts/:customFrontId/restore", "write:fronting"],

  // Fronting Sessions
  ["GET /systems/:systemId/fronting-sessions", "read:fronting"],
  ["POST /systems/:systemId/fronting-sessions", "write:fronting"],
  ["GET /systems/:systemId/fronting-sessions/:sessionId", "read:fronting"],
  ["PUT /systems/:systemId/fronting-sessions/:sessionId", "write:fronting"],
  ["DELETE /systems/:systemId/fronting-sessions/:sessionId", "delete:fronting"],
  ["POST /systems/:systemId/fronting-sessions/:sessionId/archive", "write:fronting"],
  ["POST /systems/:systemId/fronting-sessions/:sessionId/restore", "write:fronting"],
  ["POST /systems/:systemId/fronting-sessions/:sessionId/end", "write:fronting"],
  ["GET /systems/:systemId/fronting/active", "read:fronting"],

  // Fronting Comments
  ["GET /systems/:systemId/fronting-sessions/:sessionId/comments", "read:fronting"],
  ["POST /systems/:systemId/fronting-sessions/:sessionId/comments", "write:fronting"],
  ["GET /systems/:systemId/fronting-sessions/:sessionId/comments/:commentId", "read:fronting"],
  ["PUT /systems/:systemId/fronting-sessions/:sessionId/comments/:commentId", "write:fronting"],
  ["DELETE /systems/:systemId/fronting-sessions/:sessionId/comments/:commentId", "delete:fronting"],
  [
    "POST /systems/:systemId/fronting-sessions/:sessionId/comments/:commentId/archive",
    "write:fronting",
  ],
  [
    "POST /systems/:systemId/fronting-sessions/:sessionId/comments/:commentId/restore",
    "write:fronting",
  ],

  // Fronting Reports
  ["GET /systems/:systemId/fronting-reports", "read:reports"],
  ["POST /systems/:systemId/fronting-reports", "write:reports"],
  ["GET /systems/:systemId/fronting-reports/:reportId", "read:reports"],
  ["PUT /systems/:systemId/fronting-reports/:reportId", "write:reports"],
  ["DELETE /systems/:systemId/fronting-reports/:reportId", "delete:reports"],
  ["POST /systems/:systemId/fronting-reports/:reportId/archive", "write:reports"],
  ["POST /systems/:systemId/fronting-reports/:reportId/restore", "write:reports"],

  // Analytics
  ["GET /systems/:systemId/analytics/fronting", "read:reports"],
  ["GET /systems/:systemId/analytics/co-fronting", "read:reports"],

  // Blobs
  ["GET /systems/:systemId/blobs", "read:blobs"],
  ["GET /systems/:systemId/blobs/:blobId", "read:blobs"],
  ["DELETE /systems/:systemId/blobs/:blobId", "delete:blobs"],
  ["POST /systems/:systemId/blobs/:blobId/confirm", "write:blobs"],
  ["GET /systems/:systemId/blobs/:blobId/download-url", "read:blobs"],
  ["POST /systems/:systemId/blobs/upload-url", "write:blobs"],

  // Buckets
  ["GET /systems/:systemId/buckets", "read:buckets"],
  ["POST /systems/:systemId/buckets", "write:buckets"],
  ["GET /systems/:systemId/buckets/:bucketId", "read:buckets"],
  ["PUT /systems/:systemId/buckets/:bucketId", "write:buckets"],
  ["DELETE /systems/:systemId/buckets/:bucketId", "delete:buckets"],
  ["POST /systems/:systemId/buckets/:bucketId/archive", "write:buckets"],
  ["POST /systems/:systemId/buckets/:bucketId/restore", "write:buckets"],
  ["GET /systems/:systemId/buckets/:bucketId/friends", "read:buckets"],
  ["POST /systems/:systemId/buckets/:bucketId/friends", "write:buckets"],
  ["DELETE /systems/:systemId/buckets/:bucketId/friends/:connectionId", "write:buckets"],
  ["GET /systems/:systemId/buckets/:bucketId/tags", "read:buckets"],
  ["POST /systems/:systemId/buckets/:bucketId/tags", "write:buckets"],
  ["DELETE /systems/:systemId/buckets/:bucketId/tags/:entityType/:entityId", "write:buckets"],
  ["GET /systems/:systemId/buckets/:bucketId/export", "read:buckets"],
  ["GET /systems/:systemId/buckets/:bucketId/export/manifest", "read:buckets"],
  ["POST /systems/:systemId/buckets/:bucketId/rotations", "write:buckets"],
  ["GET /systems/:systemId/buckets/:bucketId/rotations/:rotationId", "read:buckets"],
  ["POST /systems/:systemId/buckets/:bucketId/rotations/:rotationId/claim", "write:buckets"],
  ["POST /systems/:systemId/buckets/:bucketId/rotations/:rotationId/complete", "write:buckets"],
  ["POST /systems/:systemId/buckets/:bucketId/rotations/:rotationId/retry", "write:buckets"],

  // Channels
  ["GET /systems/:systemId/channels", "read:channels"],
  ["POST /systems/:systemId/channels", "write:channels"],
  ["GET /systems/:systemId/channels/:channelId", "read:channels"],
  ["PUT /systems/:systemId/channels/:channelId", "write:channels"],
  ["DELETE /systems/:systemId/channels/:channelId", "delete:channels"],
  ["POST /systems/:systemId/channels/:channelId/archive", "write:channels"],
  ["POST /systems/:systemId/channels/:channelId/restore", "write:channels"],

  // Messages
  ["GET /systems/:systemId/channels/:channelId/messages", "read:messages"],
  ["POST /systems/:systemId/channels/:channelId/messages", "write:messages"],
  ["GET /systems/:systemId/channels/:channelId/messages/:messageId", "read:messages"],
  ["PUT /systems/:systemId/channels/:channelId/messages/:messageId", "write:messages"],
  ["DELETE /systems/:systemId/channels/:channelId/messages/:messageId", "delete:messages"],
  ["POST /systems/:systemId/channels/:channelId/messages/:messageId/archive", "write:messages"],
  ["POST /systems/:systemId/channels/:channelId/messages/:messageId/restore", "write:messages"],

  // Board Messages
  ["GET /systems/:systemId/board-messages", "read:messages"],
  ["POST /systems/:systemId/board-messages", "write:messages"],
  ["GET /systems/:systemId/board-messages/:messageId", "read:messages"],
  ["PUT /systems/:systemId/board-messages/:messageId", "write:messages"],
  ["DELETE /systems/:systemId/board-messages/:messageId", "delete:messages"],
  ["POST /systems/:systemId/board-messages/:messageId/archive", "write:messages"],
  ["POST /systems/:systemId/board-messages/:messageId/restore", "write:messages"],
  ["POST /systems/:systemId/board-messages/reorder", "write:messages"],
  ["POST /systems/:systemId/board-messages/:messageId/pin", "write:messages"],
  ["POST /systems/:systemId/board-messages/:messageId/unpin", "write:messages"],

  // Notes
  ["GET /systems/:systemId/notes", "read:notes"],
  ["POST /systems/:systemId/notes", "write:notes"],
  ["GET /systems/:systemId/notes/:noteId", "read:notes"],
  ["PUT /systems/:systemId/notes/:noteId", "write:notes"],
  ["DELETE /systems/:systemId/notes/:noteId", "delete:notes"],
  ["POST /systems/:systemId/notes/:noteId/archive", "write:notes"],
  ["POST /systems/:systemId/notes/:noteId/restore", "write:notes"],

  // Polls
  ["GET /systems/:systemId/polls", "read:polls"],
  ["POST /systems/:systemId/polls", "write:polls"],
  ["GET /systems/:systemId/polls/:pollId", "read:polls"],
  ["PUT /systems/:systemId/polls/:pollId", "write:polls"],
  ["DELETE /systems/:systemId/polls/:pollId", "delete:polls"],
  ["POST /systems/:systemId/polls/:pollId/archive", "write:polls"],
  ["POST /systems/:systemId/polls/:pollId/restore", "write:polls"],
  ["POST /systems/:systemId/polls/:pollId/close", "write:polls"],
  ["GET /systems/:systemId/polls/:pollId/results", "read:polls"],
  ["GET /systems/:systemId/polls/:pollId/votes", "read:polls"],
  ["POST /systems/:systemId/polls/:pollId/votes", "write:polls"],
  ["PUT /systems/:systemId/polls/:pollId/votes/:voteId", "write:polls"],
  ["DELETE /systems/:systemId/polls/:pollId/votes/:voteId", "delete:polls"],

  // Relationships
  ["GET /systems/:systemId/relationships", "read:relationships"],
  ["POST /systems/:systemId/relationships", "write:relationships"],
  ["GET /systems/:systemId/relationships/:relationshipId", "read:relationships"],
  ["PUT /systems/:systemId/relationships/:relationshipId", "write:relationships"],
  ["DELETE /systems/:systemId/relationships/:relationshipId", "delete:relationships"],
  ["POST /systems/:systemId/relationships/:relationshipId/archive", "write:relationships"],
  ["POST /systems/:systemId/relationships/:relationshipId/restore", "write:relationships"],

  // Fields
  ["GET /systems/:systemId/fields", "read:fields"],
  ["POST /systems/:systemId/fields", "write:fields"],
  ["GET /systems/:systemId/fields/:fieldId", "read:fields"],
  ["PUT /systems/:systemId/fields/:fieldId", "write:fields"],
  ["DELETE /systems/:systemId/fields/:fieldId", "delete:fields"],
  ["POST /systems/:systemId/fields/:fieldId/archive", "write:fields"],
  ["POST /systems/:systemId/fields/:fieldId/restore", "write:fields"],
  ["GET /systems/:systemId/fields/:fieldId/bucket-visibility", "read:fields"],
  ["POST /systems/:systemId/fields/:fieldId/bucket-visibility", "write:fields"],
  ["DELETE /systems/:systemId/fields/:fieldId/bucket-visibility/:bucketId", "delete:fields"],

  // Lifecycle Events
  ["GET /systems/:systemId/lifecycle-events", "read:lifecycle-events"],
  ["POST /systems/:systemId/lifecycle-events", "write:lifecycle-events"],
  ["GET /systems/:systemId/lifecycle-events/:eventId", "read:lifecycle-events"],
  ["PUT /systems/:systemId/lifecycle-events/:eventId", "write:lifecycle-events"],
  ["DELETE /systems/:systemId/lifecycle-events/:eventId", "delete:lifecycle-events"],
  ["POST /systems/:systemId/lifecycle-events/:eventId/archive", "write:lifecycle-events"],
  ["POST /systems/:systemId/lifecycle-events/:eventId/restore", "write:lifecycle-events"],

  // Innerworld
  ["GET /systems/:systemId/innerworld/entities", "read:innerworld"],
  ["POST /systems/:systemId/innerworld/entities", "write:innerworld"],
  ["GET /systems/:systemId/innerworld/entities/:entityId", "read:innerworld"],
  ["PUT /systems/:systemId/innerworld/entities/:entityId", "write:innerworld"],
  ["DELETE /systems/:systemId/innerworld/entities/:entityId", "delete:innerworld"],
  ["POST /systems/:systemId/innerworld/entities/:entityId/archive", "write:innerworld"],
  ["POST /systems/:systemId/innerworld/entities/:entityId/restore", "write:innerworld"],
  ["GET /systems/:systemId/innerworld/regions", "read:innerworld"],
  ["POST /systems/:systemId/innerworld/regions", "write:innerworld"],
  ["GET /systems/:systemId/innerworld/regions/:regionId", "read:innerworld"],
  ["PUT /systems/:systemId/innerworld/regions/:regionId", "write:innerworld"],
  ["DELETE /systems/:systemId/innerworld/regions/:regionId", "delete:innerworld"],
  ["POST /systems/:systemId/innerworld/regions/:regionId/archive", "write:innerworld"],
  ["POST /systems/:systemId/innerworld/regions/:regionId/restore", "write:innerworld"],
  ["GET /systems/:systemId/innerworld/canvas", "read:innerworld"],
  ["PUT /systems/:systemId/innerworld/canvas", "write:innerworld"],

  // Check-In Records
  ["GET /systems/:systemId/check-in-records", "read:check-ins"],
  ["POST /systems/:systemId/check-in-records", "write:check-ins"],
  ["GET /systems/:systemId/check-in-records/:recordId", "read:check-ins"],
  ["DELETE /systems/:systemId/check-in-records/:recordId", "delete:check-ins"],
  ["POST /systems/:systemId/check-in-records/:recordId/archive", "write:check-ins"],
  ["POST /systems/:systemId/check-in-records/:recordId/restore", "write:check-ins"],
  ["POST /systems/:systemId/check-in-records/:recordId/dismiss", "write:check-ins"],
  ["POST /systems/:systemId/check-in-records/:recordId/respond", "write:check-ins"],

  // Timer Configs
  ["GET /systems/:systemId/timer-configs", "read:timers"],
  ["POST /systems/:systemId/timer-configs", "write:timers"],
  ["GET /systems/:systemId/timer-configs/:timerId", "read:timers"],
  ["PUT /systems/:systemId/timer-configs/:timerId", "write:timers"],
  ["DELETE /systems/:systemId/timer-configs/:timerId", "delete:timers"],
  ["POST /systems/:systemId/timer-configs/:timerId/archive", "write:timers"],
  ["POST /systems/:systemId/timer-configs/:timerId/restore", "write:timers"],

  // Webhook Configs
  ["GET /systems/:systemId/webhook-configs", "read:webhooks"],
  ["POST /systems/:systemId/webhook-configs", "write:webhooks"],
  ["GET /systems/:systemId/webhook-configs/:webhookId", "read:webhooks"],
  ["PUT /systems/:systemId/webhook-configs/:webhookId", "write:webhooks"],
  ["DELETE /systems/:systemId/webhook-configs/:webhookId", "delete:webhooks"],
  ["POST /systems/:systemId/webhook-configs/:webhookId/archive", "write:webhooks"],
  ["POST /systems/:systemId/webhook-configs/:webhookId/restore", "write:webhooks"],
  ["POST /systems/:systemId/webhook-configs/:webhookId/rotate-secret", "write:webhooks"],
  ["POST /systems/:systemId/webhook-configs/:webhookId/test", "write:webhooks"],

  // Webhook Deliveries
  ["GET /systems/:systemId/webhook-deliveries", "read:webhooks"],
  ["GET /systems/:systemId/webhook-deliveries/:deliveryId", "read:webhooks"],
  ["DELETE /systems/:systemId/webhook-deliveries/:deliveryId", "delete:webhooks"],

  // Acknowledgements
  ["GET /systems/:systemId/acknowledgements", "read:acknowledgements"],
  ["POST /systems/:systemId/acknowledgements", "write:acknowledgements"],
  ["GET /systems/:systemId/acknowledgements/:acknowledgementId", "read:acknowledgements"],
  ["DELETE /systems/:systemId/acknowledgements/:acknowledgementId", "delete:acknowledgements"],
  ["POST /systems/:systemId/acknowledgements/:acknowledgementId/archive", "write:acknowledgements"],
  ["POST /systems/:systemId/acknowledgements/:acknowledgementId/restore", "write:acknowledgements"],
  ["POST /systems/:systemId/acknowledgements/:acknowledgementId/confirm", "write:acknowledgements"],

  // API Keys
  ["GET /systems/:systemId/api-keys", "full"],
  ["POST /systems/:systemId/api-keys", "full"],
  ["GET /systems/:systemId/api-keys/:apiKeyId", "full"],
  ["POST /systems/:systemId/api-keys/:apiKeyId/revoke", "full"],

  // Settings
  ["GET /systems/:systemId/settings", "read:system"],
  ["PUT /systems/:systemId/settings", "write:system"],
  ["POST /systems/:systemId/settings/pin", "write:system"],
  ["DELETE /systems/:systemId/settings/pin", "write:system"],
  ["POST /systems/:systemId/settings/pin/verify", "read:system"],

  // Nomenclature
  ["GET /systems/:systemId/nomenclature", "read:system"],
  ["PUT /systems/:systemId/nomenclature", "write:system"],

  // Setup
  ["GET /systems/:systemId/setup/status", "read:system"],
  ["POST /systems/:systemId/setup/nomenclature", "write:system"],
  ["POST /systems/:systemId/setup/profile", "write:system"],
  ["POST /systems/:systemId/setup/complete", "write:system"],

  // Snapshots
  ["GET /systems/:systemId/snapshots", "read:system"],
  ["POST /systems/:systemId/snapshots", "write:system"],
  ["GET /systems/:systemId/snapshots/:snapshotId", "read:system"],
  ["DELETE /systems/:systemId/snapshots/:snapshotId", "delete:system"],

  // Import jobs
  ["GET /systems/:systemId/import-jobs", "read:system"],
  ["POST /systems/:systemId/import-jobs", "write:system"],
  ["GET /systems/:systemId/import-jobs/:importJobId", "read:system"],
  ["PATCH /systems/:systemId/import-jobs/:importJobId", "write:system"],

  // Import entity refs
  ["GET /systems/:systemId/import-entity-refs", "read:system"],
  ["GET /systems/:systemId/import-entity-refs/lookup", "read:system"],

  // Structure Entity Types
  ["GET /systems/:systemId/structure/entity-types", "read:structure"],
  ["POST /systems/:systemId/structure/entity-types", "write:structure"],
  ["GET /systems/:systemId/structure/entity-types/:entityTypeId", "read:structure"],
  ["PUT /systems/:systemId/structure/entity-types/:entityTypeId", "write:structure"],
  ["DELETE /systems/:systemId/structure/entity-types/:entityTypeId", "delete:structure"],
  ["POST /systems/:systemId/structure/entity-types/:entityTypeId/archive", "write:structure"],
  ["POST /systems/:systemId/structure/entity-types/:entityTypeId/restore", "write:structure"],

  // Structure Entities
  ["GET /systems/:systemId/structure/entities", "read:structure"],
  ["POST /systems/:systemId/structure/entities", "write:structure"],
  ["GET /systems/:systemId/structure/entities/:entityId", "read:structure"],
  ["PUT /systems/:systemId/structure/entities/:entityId", "write:structure"],
  ["DELETE /systems/:systemId/structure/entities/:entityId", "delete:structure"],
  ["POST /systems/:systemId/structure/entities/:entityId/archive", "write:structure"],
  ["POST /systems/:systemId/structure/entities/:entityId/restore", "write:structure"],
  ["GET /systems/:systemId/structure/entities/:entityId/hierarchy", "read:structure"],

  // Structure Links
  ["GET /systems/:systemId/structure/entity-links", "read:structure"],
  ["POST /systems/:systemId/structure/entity-links", "write:structure"],
  ["PUT /systems/:systemId/structure/entity-links/:linkId", "write:structure"],
  ["DELETE /systems/:systemId/structure/entity-links/:linkId", "delete:structure"],

  // Structure Member Links
  ["GET /systems/:systemId/structure/entity-member-links", "read:structure"],
  ["POST /systems/:systemId/structure/entity-member-links", "write:structure"],
  ["DELETE /systems/:systemId/structure/entity-member-links/:linkId", "delete:structure"],

  // Structure Associations
  ["GET /systems/:systemId/structure/entity-associations", "read:structure"],
  ["POST /systems/:systemId/structure/entity-associations", "write:structure"],
  ["DELETE /systems/:systemId/structure/entity-associations/:associationId", "delete:structure"],

  // Device Tokens
  ["GET /systems/:systemId/device-tokens", "read:notifications"],
  ["POST /systems/:systemId/device-tokens", "write:notifications"],
  ["PUT /systems/:systemId/device-tokens/:tokenId", "write:notifications"],
  ["DELETE /systems/:systemId/device-tokens/:tokenId", "delete:notifications"],
  ["POST /systems/:systemId/device-tokens/:tokenId/revoke", "write:notifications"],

  // Notification Configs
  ["GET /systems/:systemId/notification-configs", "read:notifications"],
  ["PATCH /systems/:systemId/notification-configs/:eventType", "write:notifications"],

  // Notification Stream
  ["GET /notifications/stream", "read:notifications"],
];

// ---------------------------------------------------------------------------
// tRPC entries
// ---------------------------------------------------------------------------

const TRPC_ENTRIES: readonly [string, RequiredScope][] = [
  // member
  ["member.create", "write:members"],
  ["member.update", "write:members"],
  ["member.duplicate", "write:members"],
  ["member.archive", "write:members"],
  ["member.restore", "write:members"],
  ["member.get", "read:members"],
  ["member.list", "read:members"],
  ["member.listMemberships", "read:members"],
  ["member.delete", "delete:members"],

  // memberPhoto
  ["memberPhoto.create", "write:members"],
  ["memberPhoto.archive", "write:members"],
  ["memberPhoto.restore", "write:members"],
  ["memberPhoto.reorder", "write:members"],
  ["memberPhoto.get", "read:members"],
  ["memberPhoto.list", "read:members"],
  ["memberPhoto.delete", "delete:members"],

  // group
  ["group.create", "write:groups"],
  ["group.update", "write:groups"],
  ["group.archive", "write:groups"],
  ["group.restore", "write:groups"],
  ["group.move", "write:groups"],
  ["group.copy", "write:groups"],
  ["group.reorder", "write:groups"],
  ["group.addMember", "write:groups"],
  ["group.removeMember", "write:groups"],
  ["group.get", "read:groups"],
  ["group.list", "read:groups"],
  ["group.getTree", "read:groups"],
  ["group.listMembers", "read:groups"],
  ["group.delete", "delete:groups"],

  // customFront
  ["customFront.create", "write:fronting"],
  ["customFront.update", "write:fronting"],
  ["customFront.archive", "write:fronting"],
  ["customFront.restore", "write:fronting"],
  ["customFront.get", "read:fronting"],
  ["customFront.list", "read:fronting"],
  ["customFront.delete", "delete:fronting"],

  // frontingSession
  ["frontingSession.create", "write:fronting"],
  ["frontingSession.update", "write:fronting"],
  ["frontingSession.end", "write:fronting"],
  ["frontingSession.archive", "write:fronting"],
  ["frontingSession.restore", "write:fronting"],
  ["frontingSession.get", "read:fronting"],
  ["frontingSession.list", "read:fronting"],
  ["frontingSession.getActive", "read:fronting"],
  ["frontingSession.delete", "delete:fronting"],

  // frontingComment
  ["frontingComment.create", "write:fronting"],
  ["frontingComment.update", "write:fronting"],
  ["frontingComment.archive", "write:fronting"],
  ["frontingComment.restore", "write:fronting"],
  ["frontingComment.get", "read:fronting"],
  ["frontingComment.list", "read:fronting"],
  ["frontingComment.delete", "delete:fronting"],

  // frontingReport
  ["frontingReport.create", "write:reports"],
  ["frontingReport.update", "write:reports"],
  ["frontingReport.archive", "write:reports"],
  ["frontingReport.restore", "write:reports"],
  ["frontingReport.get", "read:reports"],
  ["frontingReport.list", "read:reports"],
  ["frontingReport.delete", "delete:reports"],

  // analytics
  ["analytics.fronting", "read:reports"],
  ["analytics.coFronting", "read:reports"],

  // blob
  ["blob.createUploadUrl", "write:blobs"],
  ["blob.confirmUpload", "write:blobs"],
  ["blob.get", "read:blobs"],
  ["blob.list", "read:blobs"],
  ["blob.getDownloadUrl", "read:blobs"],
  ["blob.delete", "delete:blobs"],

  // bucket
  ["bucket.create", "write:buckets"],
  ["bucket.update", "write:buckets"],
  ["bucket.archive", "write:buckets"],
  ["bucket.restore", "write:buckets"],
  ["bucket.assignFriend", "write:buckets"],
  ["bucket.unassignFriend", "write:buckets"],
  ["bucket.tagContent", "write:buckets"],
  ["bucket.untagContent", "write:buckets"],
  ["bucket.initiateRotation", "write:buckets"],
  ["bucket.claimRotationChunk", "write:buckets"],
  ["bucket.completeRotationChunk", "write:buckets"],
  ["bucket.retryRotation", "write:buckets"],
  ["bucket.get", "read:buckets"],
  ["bucket.list", "read:buckets"],
  ["bucket.listFriendAssignments", "read:buckets"],
  ["bucket.listTags", "read:buckets"],
  ["bucket.exportManifest", "read:buckets"],
  ["bucket.exportPage", "read:buckets"],
  ["bucket.rotationProgress", "read:buckets"],
  ["bucket.delete", "delete:buckets"],

  // channel
  ["channel.create", "write:channels"],
  ["channel.update", "write:channels"],
  ["channel.archive", "write:channels"],
  ["channel.restore", "write:channels"],
  ["channel.get", "read:channels"],
  ["channel.list", "read:channels"],
  ["channel.delete", "delete:channels"],

  // message
  ["message.create", "write:messages"],
  ["message.update", "write:messages"],
  ["message.archive", "write:messages"],
  ["message.restore", "write:messages"],
  ["message.get", "read:messages"],
  ["message.list", "read:messages"],
  ["message.onChange", "read:messages"],
  ["message.delete", "delete:messages"],

  // boardMessage
  ["boardMessage.create", "write:messages"],
  ["boardMessage.update", "write:messages"],
  ["boardMessage.archive", "write:messages"],
  ["boardMessage.restore", "write:messages"],
  ["boardMessage.reorder", "write:messages"],
  ["boardMessage.pin", "write:messages"],
  ["boardMessage.unpin", "write:messages"],
  ["boardMessage.get", "read:messages"],
  ["boardMessage.list", "read:messages"],
  ["boardMessage.onChange", "read:messages"],
  ["boardMessage.delete", "delete:messages"],

  // note
  ["note.create", "write:notes"],
  ["note.update", "write:notes"],
  ["note.archive", "write:notes"],
  ["note.restore", "write:notes"],
  ["note.get", "read:notes"],
  ["note.list", "read:notes"],
  ["note.delete", "delete:notes"],

  // poll
  ["poll.create", "write:polls"],
  ["poll.update", "write:polls"],
  ["poll.close", "write:polls"],
  ["poll.archive", "write:polls"],
  ["poll.restore", "write:polls"],
  ["poll.castVote", "write:polls"],
  ["poll.updateVote", "write:polls"],
  ["poll.get", "read:polls"],
  ["poll.list", "read:polls"],
  ["poll.listVotes", "read:polls"],
  ["poll.results", "read:polls"],
  ["poll.onChange", "read:polls"],
  ["poll.delete", "delete:polls"],
  ["poll.deleteVote", "delete:polls"],

  // relationship
  ["relationship.create", "write:relationships"],
  ["relationship.update", "write:relationships"],
  ["relationship.archive", "write:relationships"],
  ["relationship.restore", "write:relationships"],
  ["relationship.get", "read:relationships"],
  ["relationship.list", "read:relationships"],
  ["relationship.delete", "delete:relationships"],

  // field (nested: definition, value, bucketVisibility)
  ["field.definition.create", "write:fields"],
  ["field.definition.update", "write:fields"],
  ["field.definition.archive", "write:fields"],
  ["field.definition.restore", "write:fields"],
  ["field.definition.get", "read:fields"],
  ["field.definition.list", "read:fields"],
  ["field.definition.delete", "delete:fields"],
  ["field.value.set", "write:fields"],
  ["field.value.list", "read:fields"],
  ["field.value.remove", "delete:fields"],
  ["field.bucketVisibility.set", "write:fields"],
  ["field.bucketVisibility.list", "read:fields"],
  ["field.bucketVisibility.remove", "delete:fields"],

  // lifecycleEvent
  ["lifecycleEvent.create", "write:lifecycle-events"],
  ["lifecycleEvent.update", "write:lifecycle-events"],
  ["lifecycleEvent.archive", "write:lifecycle-events"],
  ["lifecycleEvent.restore", "write:lifecycle-events"],
  ["lifecycleEvent.get", "read:lifecycle-events"],
  ["lifecycleEvent.list", "read:lifecycle-events"],
  ["lifecycleEvent.delete", "delete:lifecycle-events"],

  // innerworld (nested: entity, region, canvas)
  ["innerworld.entity.create", "write:innerworld"],
  ["innerworld.entity.update", "write:innerworld"],
  ["innerworld.entity.archive", "write:innerworld"],
  ["innerworld.entity.restore", "write:innerworld"],
  ["innerworld.entity.get", "read:innerworld"],
  ["innerworld.entity.list", "read:innerworld"],
  ["innerworld.entity.delete", "delete:innerworld"],
  ["innerworld.region.create", "write:innerworld"],
  ["innerworld.region.update", "write:innerworld"],
  ["innerworld.region.archive", "write:innerworld"],
  ["innerworld.region.restore", "write:innerworld"],
  ["innerworld.region.get", "read:innerworld"],
  ["innerworld.region.list", "read:innerworld"],
  ["innerworld.region.delete", "delete:innerworld"],
  ["innerworld.canvas.get", "read:innerworld"],
  ["innerworld.canvas.upsert", "write:innerworld"],

  // checkInRecord
  ["checkInRecord.create", "write:check-ins"],
  ["checkInRecord.respond", "write:check-ins"],
  ["checkInRecord.dismiss", "write:check-ins"],
  ["checkInRecord.archive", "write:check-ins"],
  ["checkInRecord.restore", "write:check-ins"],
  ["checkInRecord.get", "read:check-ins"],
  ["checkInRecord.list", "read:check-ins"],
  ["checkInRecord.delete", "delete:check-ins"],

  // timerConfig
  ["timerConfig.create", "write:timers"],
  ["timerConfig.update", "write:timers"],
  ["timerConfig.archive", "write:timers"],
  ["timerConfig.restore", "write:timers"],
  ["timerConfig.get", "read:timers"],
  ["timerConfig.list", "read:timers"],
  ["timerConfig.delete", "delete:timers"],

  // webhookConfig
  ["webhookConfig.create", "write:webhooks"],
  ["webhookConfig.update", "write:webhooks"],
  ["webhookConfig.archive", "write:webhooks"],
  ["webhookConfig.restore", "write:webhooks"],
  ["webhookConfig.rotateSecret", "write:webhooks"],
  ["webhookConfig.test", "write:webhooks"],
  ["webhookConfig.list", "read:webhooks"],
  ["webhookConfig.get", "read:webhooks"],
  ["webhookConfig.delete", "delete:webhooks"],

  // webhookDelivery
  ["webhookDelivery.list", "read:webhooks"],
  ["webhookDelivery.get", "read:webhooks"],
  ["webhookDelivery.delete", "delete:webhooks"],

  // acknowledgement
  ["acknowledgement.create", "write:acknowledgements"],
  ["acknowledgement.confirm", "write:acknowledgements"],
  ["acknowledgement.archive", "write:acknowledgements"],
  ["acknowledgement.restore", "write:acknowledgements"],
  ["acknowledgement.get", "read:acknowledgements"],
  ["acknowledgement.list", "read:acknowledgements"],
  ["acknowledgement.onChange", "read:acknowledgements"],
  ["acknowledgement.delete", "delete:acknowledgements"],

  // apiKey
  ["apiKey.create", "full"],
  ["apiKey.get", "full"],
  ["apiKey.list", "full"],
  ["apiKey.revoke", "full"],

  // system (get only — create/list excluded as session-only)
  ["system.get", "read:system"],
  ["system.update", "write:system"],
  ["system.archive", "write:system"],
  ["system.duplicate", "write:system"],
  ["system.purge", "delete:system"],

  // systemSettings (nested: settings, nomenclature, pin, setup)
  ["systemSettings.settings.get", "read:system"],
  ["systemSettings.settings.update", "write:system"],
  ["systemSettings.nomenclature.get", "read:system"],
  ["systemSettings.nomenclature.update", "write:system"],
  ["systemSettings.pin.verify", "read:system"],
  ["systemSettings.pin.set", "write:system"],
  ["systemSettings.pin.remove", "write:system"],
  ["systemSettings.setup.getStatus", "read:system"],
  ["systemSettings.setup.nomenclatureStep", "write:system"],
  ["systemSettings.setup.profileStep", "write:system"],
  ["systemSettings.setup.complete", "write:system"],

  // snapshot
  ["snapshot.create", "write:system"],
  ["snapshot.get", "read:system"],
  ["snapshot.list", "read:system"],
  ["snapshot.delete", "delete:system"],

  // importJob
  ["importJob.create", "write:system"],
  ["importJob.get", "read:system"],
  ["importJob.list", "read:system"],
  ["importJob.update", "write:system"],

  // importEntityRef
  ["importEntityRef.list", "read:system"],
  ["importEntityRef.lookup", "read:system"],

  // deviceToken
  ["deviceToken.register", "write:notifications"],
  ["deviceToken.update", "write:notifications"],
  ["deviceToken.revoke", "write:notifications"],
  ["deviceToken.list", "read:notifications"],
  ["deviceToken.delete", "delete:notifications"],

  // notificationConfig
  ["notificationConfig.get", "read:notifications"],
  ["notificationConfig.list", "read:notifications"],
  ["notificationConfig.update", "write:notifications"],

  // structure (nested: entityType, entity, link, memberLink, association)
  ["structure.entityType.create", "write:structure"],
  ["structure.entityType.update", "write:structure"],
  ["structure.entityType.archive", "write:structure"],
  ["structure.entityType.restore", "write:structure"],
  ["structure.entityType.get", "read:structure"],
  ["structure.entityType.list", "read:structure"],
  ["structure.entityType.delete", "delete:structure"],
  ["structure.entity.create", "write:structure"],
  ["structure.entity.update", "write:structure"],
  ["structure.entity.archive", "write:structure"],
  ["structure.entity.restore", "write:structure"],
  ["structure.entity.get", "read:structure"],
  ["structure.entity.getHierarchy", "read:structure"],
  ["structure.entity.list", "read:structure"],
  ["structure.entity.delete", "delete:structure"],
  ["structure.link.create", "write:structure"],
  ["structure.link.update", "write:structure"],
  ["structure.link.list", "read:structure"],
  ["structure.link.delete", "delete:structure"],
  ["structure.memberLink.create", "write:structure"],
  ["structure.memberLink.list", "read:structure"],
  ["structure.memberLink.delete", "delete:structure"],
  ["structure.association.create", "write:structure"],
  ["structure.association.list", "read:structure"],
  ["structure.association.delete", "delete:structure"],
];

// ---------------------------------------------------------------------------
// Build the registry
// ---------------------------------------------------------------------------

function buildRegistry(): ScopeRegistry {
  const rest = new Map<string, ScopeEntry>();
  for (const [key, scope] of REST_ENTRIES) {
    if (rest.has(key)) {
      throw new Error(`Duplicate REST scope registry key: "${key}"`);
    }
    rest.set(key, { scope });
  }

  const trpc = new Map<string, ScopeEntry>();
  for (const [key, scope] of TRPC_ENTRIES) {
    if (trpc.has(key)) {
      throw new Error(`Duplicate tRPC scope registry key: "${key}"`);
    }
    trpc.set(key, { scope });
  }

  return { rest, trpc };
}

/** Central registry of required scopes for all REST routes and tRPC procedures. */
export const SCOPE_REGISTRY: ScopeRegistry = buildRegistry();
