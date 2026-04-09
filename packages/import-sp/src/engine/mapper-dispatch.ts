/**
 * Mapper dispatch table.
 *
 * Maps each `SpCollectionName` to the Zod validator + per-document mapper +
 * resulting `ImportEntityType`. The orchestrator looks up the entry by
 * collection name and calls `map(rawDocument, ctx)`; the entry takes care of
 * Phase B validation before delegating to the mapper.
 *
 * Keeping this table separate from the engine loop isolates the catalog of
 * "which mapper handles which collection" from the iteration logic and keeps
 * `import-engine.ts` short. Each entry uses an internal generic helper so the
 * boundary signature is uniform — `(unknown, MappingContext) => MapperResult<unknown>`
 * — while the captured mapper still sees a fully-typed parsed document.
 */
import { z } from "zod/v4";

import { mapBoardMessage } from "../mappers/board-message.mapper.js";
import { mapBucket } from "../mappers/bucket.mapper.js";
import { mapChannel, mapChannelCategory } from "../mappers/channel.mapper.js";
import { mapChatMessage } from "../mappers/chat-message.mapper.js";
import { mapCustomFront } from "../mappers/custom-front.mapper.js";
import { mapFieldDefinition } from "../mappers/field-definition.mapper.js";
import { mapFrontingComment } from "../mappers/fronting-comment.mapper.js";
import { mapFrontingSession } from "../mappers/fronting-session.mapper.js";
import { mapGroup } from "../mappers/group.mapper.js";
import { mapJournalEntry } from "../mappers/journal-entry.mapper.js";
import { failed, type MapperResult } from "../mappers/mapper-result.js";
import { mapMember } from "../mappers/member.mapper.js";
import { mapPoll } from "../mappers/poll.mapper.js";
import { mapSystemProfile } from "../mappers/system-profile.mapper.js";
import { mapSystemSettings } from "../mappers/system-settings.mapper.js";
import {
  SPBoardMessageSchema,
  SPChannelCategorySchema,
  SPChannelSchema,
  SPChatMessageSchema,
  SPCommentSchema,
  SPCustomFieldSchema,
  SPFrontHistorySchema,
  SPFrontStatusSchema,
  SPGroupSchema,
  SPMemberSchema,
  SPNoteSchema,
  SPPollSchema,
  SPPrivacyBucketSchema,
  SPPrivateSchema,
  SPUserSchema,
} from "../validators/sp-payload.js";

import { collectionToEntityType } from "./entity-type-map.js";

import type { MappingContext } from "../mappers/context.js";
import type { SpCollectionName } from "../sources/sp-collections.js";
import type { ImportEntityType } from "@pluralscape/types";

/**
 * One entry in the dispatch table. The `map` callback validates the raw
 * document against the captured Zod schema and, on success, hands the parsed
 * shape to the underlying mapper. Validation failure becomes a non-fatal
 * `failed` result so the engine can record the error and keep iterating.
 */
export interface MapperEntry {
  readonly entityType: ImportEntityType;
  readonly map: (document: unknown, ctx: MappingContext) => MapperResult<unknown>;
}

function entry<TSchema extends z.ZodType>(
  collection: SpCollectionName,
  schema: TSchema,
  mapper: (sp: z.infer<TSchema>, ctx: MappingContext) => MapperResult<unknown>,
): MapperEntry {
  return {
    entityType: collectionToEntityType(collection),
    map: (document, ctx) => {
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

export const MAPPER_DISPATCH: Readonly<Record<SpCollectionName, MapperEntry>> = {
  users: entry("users", SPUserSchema, mapSystemProfile),
  private: entry("private", SPPrivateSchema, mapSystemSettings),
  privacyBuckets: entry("privacyBuckets", SPPrivacyBucketSchema, mapBucket),
  customFields: entry("customFields", SPCustomFieldSchema, mapFieldDefinition),
  frontStatuses: entry("frontStatuses", SPFrontStatusSchema, mapCustomFront),
  members: entry("members", SPMemberSchema, mapMember),
  groups: entry("groups", SPGroupSchema, mapGroup),
  frontHistory: entry("frontHistory", SPFrontHistorySchema, mapFrontingSession),
  comments: entry("comments", SPCommentSchema, mapFrontingComment),
  notes: entry("notes", SPNoteSchema, mapJournalEntry),
  polls: entry("polls", SPPollSchema, mapPoll),
  channelCategories: entry("channelCategories", SPChannelCategorySchema, mapChannelCategory),
  channels: entry("channels", SPChannelSchema, mapChannel),
  chatMessages: entry("chatMessages", SPChatMessageSchema, mapChatMessage),
  boardMessages: entry("boardMessages", SPBoardMessageSchema, mapBoardMessage),
};
