/**
 * Mapper dispatch table for PK collections.
 *
 * Maps each `PkCollectionName` to its validator + mapper + entity type.
 * Member and group are single-document mappers; switch and privacy-bucket
 * are batch mappers (they need cross-document analysis).
 */
import { failed } from "@pluralscape/import-core";

import { mapPkGroup } from "../mappers/group.mapper.js";
import { mapPkMember } from "../mappers/member.mapper.js";
import { synthesizePkPrivacyBuckets } from "../mappers/privacy-bucket-synthesis.js";
import { mapSwitchBatch } from "../mappers/switch.mapper.js";
import { PKGroupSchema, PKMemberSchema } from "../validators/pk-payload.js";

import type { PkCollectionName } from "../sources/pk-collections.js";
import type {
  BatchMapperEntry,
  MapperDispatchEntry,
  MapperResult,
  MappingContext,
  SingleMapperEntry,
} from "@pluralscape/import-core";
import type { ImportCollectionType } from "@pluralscape/types";

function singleEntry<T>(
  entityType: ImportCollectionType,
  schema: {
    safeParse: (
      v: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { issues: Array<{ message?: string }> } };
  },
  mapper: (parsed: T, ctx: MappingContext) => MapperResult<unknown>,
): SingleMapperEntry {
  return {
    entityType,
    map(document: unknown, ctx: MappingContext): MapperResult<unknown> {
      const parsed = schema.safeParse(document);
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        const message = firstIssue?.message ?? "invalid document";
        return failed({ kind: "validation-failed", message: `validation: ${message}` });
      }
      return mapper(parsed.data, ctx);
    },
  };
}

const memberEntry: SingleMapperEntry = singleEntry("member", PKMemberSchema, mapPkMember);
const groupEntry: SingleMapperEntry = singleEntry("group", PKGroupSchema, mapPkGroup);

const switchEntry: BatchMapperEntry = {
  entityType: "fronting-session",
  batch: true,
  mapBatch: mapSwitchBatch,
};

const privacyBucketEntry: BatchMapperEntry = {
  entityType: "privacy-bucket",
  batch: true,
  mapBatch: synthesizePkPrivacyBuckets,
};

export const PK_MAPPER_DISPATCH: Readonly<Record<PkCollectionName, MapperDispatchEntry>> = {
  member: memberEntry,
  group: groupEntry,
  switch: switchEntry,
  "privacy-bucket": privacyBucketEntry,
};
