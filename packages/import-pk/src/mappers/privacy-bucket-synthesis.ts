/**
 * Privacy bucket synthesis mapper.
 *
 * PK has per-field privacy settings on members (e.g. `visibility: "private"`,
 * `name_privacy: "private"`). Pluralscape uses privacy buckets — tagged
 * groups that control friend visibility. This batch mapper scans all member
 * privacy data and synthesises a single "PK Private" bucket if any member
 * has at least one private field.
 *
 * The list of member IDs assigned to this bucket is stored in context
 * metadata so downstream passes can assign `bucketIds` on each member.
 */
import { mapped, type BatchMapperOutput, type SourceDocument } from "@pluralscape/import-core";
import { z } from "zod/v4";

import type { BucketEncryptedFields } from "@pluralscape/data";
import type { MappingContext } from "@pluralscape/import-core";
import type { CreateBucketBodySchema } from "@pluralscape/validation";

export type PkMappedPrivacyBucket = Omit<
  z.infer<typeof CreateBucketBodySchema>,
  "encryptedData"
> & {
  readonly encrypted: BucketEncryptedFields;
};

/** All PK privacy fields to check for "private" values. */
const PRIVACY_FIELDS = [
  "visibility",
  "name_privacy",
  "description_privacy",
  "birthday_privacy",
  "pronoun_privacy",
  "avatar_privacy",
  "banner_privacy",
  "metadata_privacy",
  "proxy_privacy",
] as const;

const PrivacyRecordSchema = z.record(z.string(), z.string());
const PrivacyScanMemberSchema = z.object({
  pkMemberId: z.string().min(1),
  privacy: PrivacyRecordSchema.optional(),
});
const PrivacyScanDocumentSchema = z.object({
  type: z.literal("privacy-scan"),
  members: z.array(PrivacyScanMemberSchema).readonly(),
});

type PrivacyScanMember = z.infer<typeof PrivacyScanMemberSchema>;

function hasAnyPrivateField(privacy: PrivacyScanMember["privacy"]): boolean {
  if (privacy === undefined) return false;
  return PRIVACY_FIELDS.some((field) => privacy[field] === "private");
}

export function synthesizePkPrivacyBuckets(
  documents: readonly SourceDocument[],
  ctx: MappingContext,
): readonly BatchMapperOutput[] {
  if (documents.length === 0) {
    ctx.addWarning({
      entityType: "privacy-bucket",
      entityId: null,
      message: "No privacy scan data available — cannot synthesize privacy buckets",
    });
    return [];
  }

  const firstDoc = documents[0];
  if (firstDoc === undefined) {
    ctx.addWarning({
      entityType: "privacy-bucket",
      entityId: null,
      message: "No member privacy data available — cannot synthesize privacy buckets",
    });
    return [];
  }

  const validation = PrivacyScanDocumentSchema.safeParse(firstDoc.document);
  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    ctx.addWarning({
      entityType: "privacy-bucket",
      entityId: firstDoc.sourceId,
      message: `Privacy scan validation failed: ${firstIssue?.message ?? "invalid document"}`,
    });
    return [];
  }

  const members = validation.data.members;
  if (members.length === 0) {
    ctx.addWarning({
      entityType: "privacy-bucket",
      entityId: null,
      message: "No member privacy data available — cannot synthesize privacy buckets",
    });
    return [];
  }

  // Collect resolved IDs for members that have any private field
  const privateMemberIds: string[] = [];
  for (const member of members) {
    if (!hasAnyPrivateField(member.privacy)) continue;
    const resolved = ctx.translate("member", member.pkMemberId);
    if (resolved !== null) {
      privateMemberIds.push(resolved);
    }
  }

  if (privateMemberIds.length === 0) {
    return [];
  }

  // Store private member IDs in context metadata for downstream bucket assignment
  ctx.storeMetadata("privacy-bucket", "synthetic:pk-private", "memberIds", privateMemberIds);

  const encrypted: BucketEncryptedFields = {
    name: "PK Private",
    description: "Synthesized from PluralKit member privacy settings during import",
  };

  return [
    {
      sourceEntityId: "synthetic:pk-private",
      result: mapped({ encrypted }),
    },
  ];
}
