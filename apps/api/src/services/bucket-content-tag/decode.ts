import { brandId } from "@pluralscape/types";

import type {
  AcknowledgementId,
  BoardMessageId,
  BucketContentEntityType,
  BucketContentTag,
  BucketId,
  ChannelId,
  CustomFrontId,
  FieldDefinitionId,
  FieldValueId,
  FrontingCommentId,
  FrontingSessionId,
  GroupId,
  InnerWorldEntityId,
  InnerWorldRegionId,
  JournalEntryId,
  MemberId,
  MemberPhotoId,
  MessageId,
  NoteId,
  PollId,
  RelationshipId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
  WikiPageId,
} from "@pluralscape/types";

/**
 * Narrow a raw `bucket_content_tags` row into a typed {@link BucketContentTag}.
 *
 * Centralizes brand application so callers get type narrowing for free.
 * The `_exhaustive: never` default is the exhaustiveness lock — adding a
 * new variant to {@link BucketContentEntityType} makes this file fail
 * typecheck until the new case is handled.
 *
 * Throws if `entityType` is not a known {@link BucketContentEntityType};
 * callers should validate via `isBucketContentEntityType` at the trust
 * boundary before persistence so this throw is never reached at runtime.
 */
export function decodeBucketContentTagRow(row: {
  readonly entityType: BucketContentEntityType;
  readonly entityId: string;
  readonly bucketId: string;
}): BucketContentTag {
  const bucketId = brandId<BucketId>(row.bucketId);
  const { entityType } = row;

  switch (entityType) {
    case "member":
      return { entityType, entityId: brandId<MemberId>(row.entityId), bucketId };
    case "group":
      return { entityType, entityId: brandId<GroupId>(row.entityId), bucketId };
    case "channel":
      return { entityType, entityId: brandId<ChannelId>(row.entityId), bucketId };
    case "message":
      return { entityType, entityId: brandId<MessageId>(row.entityId), bucketId };
    case "note":
      return { entityType, entityId: brandId<NoteId>(row.entityId), bucketId };
    case "poll":
      return { entityType, entityId: brandId<PollId>(row.entityId), bucketId };
    case "relationship":
      return { entityType, entityId: brandId<RelationshipId>(row.entityId), bucketId };
    case "structure-entity-type":
      return {
        entityType,
        entityId: brandId<SystemStructureEntityTypeId>(row.entityId),
        bucketId,
      };
    case "structure-entity":
      return { entityType, entityId: brandId<SystemStructureEntityId>(row.entityId), bucketId };
    case "journal-entry":
      return { entityType, entityId: brandId<JournalEntryId>(row.entityId), bucketId };
    case "wiki-page":
      return { entityType, entityId: brandId<WikiPageId>(row.entityId), bucketId };
    case "custom-front":
      return { entityType, entityId: brandId<CustomFrontId>(row.entityId), bucketId };
    case "fronting-session":
      return { entityType, entityId: brandId<FrontingSessionId>(row.entityId), bucketId };
    case "board-message":
      return { entityType, entityId: brandId<BoardMessageId>(row.entityId), bucketId };
    case "acknowledgement":
      return { entityType, entityId: brandId<AcknowledgementId>(row.entityId), bucketId };
    case "innerworld-entity":
      return { entityType, entityId: brandId<InnerWorldEntityId>(row.entityId), bucketId };
    case "innerworld-region":
      return { entityType, entityId: brandId<InnerWorldRegionId>(row.entityId), bucketId };
    case "field-definition":
      return { entityType, entityId: brandId<FieldDefinitionId>(row.entityId), bucketId };
    case "field-value":
      return { entityType, entityId: brandId<FieldValueId>(row.entityId), bucketId };
    case "member-photo":
      return { entityType, entityId: brandId<MemberPhotoId>(row.entityId), bucketId };
    case "fronting-comment":
      return { entityType, entityId: brandId<FrontingCommentId>(row.entityId), bucketId };
    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unhandled BucketContentEntityType: ${String(_exhaustive)}`);
    }
  }
}
