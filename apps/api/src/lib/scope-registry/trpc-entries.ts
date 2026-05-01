import type { RequiredScope } from "@pluralscape/types";

/**
 * tRPC procedure → required scope mappings.
 *
 * Keyed by `"router.procedure"` or `"router.sub.procedure"`. Consumed by
 * `scope-registry.ts` to build the immutable `SCOPE_REGISTRY.trpc` map.
 */
export const TRPC_ENTRIES: readonly [string, RequiredScope][] = [
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
  ["importEntityRef.lookupBatch", "read:system"],
  ["importEntityRef.upsertBatch", "write:system"],

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
