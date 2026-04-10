import { z } from "zod/v4";

function knownKeysOf(schema: z.ZodObject): ReadonlySet<string> {
  return new Set(Object.keys(schema.shape));
}

import type {
  SPBoardMessage,
  SPChannel,
  SPChannelCategory,
  SPChatMessage,
  SPComment,
  SPCustomField,
  SPFrontHistory,
  SPFrontStatus,
  SPGroup,
  SPMember,
  SPNote,
  SPPoll,
  SPPollOption,
  SPPollVote,
  SPPrivacyBucket,
  SPPrivate,
  SPUser,
} from "../sources/sp-types.js";

const SPDocumentIdSchema = z.string().min(1);

const NullableString = z.string().nullable().optional();
const OptionalBool = z.boolean().optional();
const OptionalNumber = z.number().nonnegative().optional();
const NonNegInt = z.number().int().nonnegative();
const Timestamp = z.number().nonnegative();

export const SPUserSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  username: z.string().min(1),
  desc: NullableString,
  avatarUrl: NullableString,
  color: NullableString,
  defaultPrivacyBucket: NullableString,
}) satisfies z.ZodType<SPUser>;

export const SPUserKnownKeys: ReadonlySet<string> = knownKeysOf(SPUserSchema);

export const SPPrivateSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  locale: NullableString,
  frontNotifs: OptionalBool,
  messageBoardNotifs: OptionalBool,
}) satisfies z.ZodType<SPPrivate>;

export const SPPrivateKnownKeys: ReadonlySet<string> = knownKeysOf(SPPrivateSchema);

export const SPMemberSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  name: z.string().min(1),
  desc: NullableString,
  pronouns: NullableString,
  color: NullableString,
  avatarUrl: NullableString,
  archived: OptionalBool,
  archivedReason: NullableString,
  preventTrusted: OptionalBool,
  private: OptionalBool,
  buckets: z.array(z.string()).readonly().optional(),
  info: z.record(z.string(), z.string()).optional(),
  frame: NullableString,
  preventsFrontNotifs: OptionalBool,
  receiveMessageBoardNotifs: OptionalBool,
  supportDescMarkdown: OptionalBool,
  created: OptionalNumber,
  lastOperationTime: OptionalNumber,
}) satisfies z.ZodType<SPMember>;

export const SPMemberKnownKeys: ReadonlySet<string> = knownKeysOf(SPMemberSchema);

export const SPFrontStatusSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  name: z.string().min(1),
  desc: NullableString,
  color: NullableString,
  avatarUrl: NullableString,
  preventTrusted: OptionalBool,
  private: OptionalBool,
}) satisfies z.ZodType<SPFrontStatus>;

export const SPFrontStatusKnownKeys: ReadonlySet<string> = knownKeysOf(SPFrontStatusSchema);

export const SPGroupSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  name: z.string().min(1),
  desc: NullableString,
  color: NullableString,
  parent: NullableString,
  members: z.array(z.string()).readonly(),
  preventTrusted: OptionalBool,
  private: OptionalBool,
}) satisfies z.ZodType<SPGroup>;

export const SPGroupKnownKeys: ReadonlySet<string> = knownKeysOf(SPGroupSchema);

export const SPCustomFieldSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  name: z.string().min(1),
  type: z.string().min(1),
  order: NonNegInt,
  preventTrusted: OptionalBool,
  private: OptionalBool,
  supportMarkdown: OptionalBool,
}) satisfies z.ZodType<SPCustomField>;

export const SPCustomFieldKnownKeys: ReadonlySet<string> = knownKeysOf(SPCustomFieldSchema);

export const SPFrontHistorySchema = z.looseObject({
  _id: SPDocumentIdSchema,
  member: z.string().min(1),
  custom: z.boolean(),
  live: z.boolean(),
  startTime: Timestamp,
  endTime: z.number().nonnegative().nullable(),
  customStatus: NullableString,
}) satisfies z.ZodType<SPFrontHistory>;

export const SPFrontHistoryKnownKeys: ReadonlySet<string> = knownKeysOf(SPFrontHistorySchema);

export const SPCommentSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  documentId: z.string().min(1),
  text: z.string(),
  time: Timestamp,
}) satisfies z.ZodType<SPComment>;

export const SPCommentKnownKeys: ReadonlySet<string> = knownKeysOf(SPCommentSchema);

export const SPNoteSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  title: z.string(),
  note: z.string(),
  date: Timestamp,
  color: NullableString,
  member: z.string().min(1),
  supportMarkdown: OptionalBool,
}) satisfies z.ZodType<SPNote>;

export const SPNoteKnownKeys: ReadonlySet<string> = knownKeysOf(SPNoteSchema);

const SPPollOptionSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  color: NullableString,
}) satisfies z.ZodType<SPPollOption>;

const SPPollVoteSchema = z.looseObject({
  id: z.string().min(1),
  comment: NullableString,
  vote: z.string().min(1),
}) satisfies z.ZodType<SPPollVote>;

export const SPPollSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  name: z.string().min(1),
  desc: NullableString,
  endTime: z.number().nonnegative().nullable().optional(),
  custom: OptionalBool,
  allowAbstain: OptionalBool,
  allowVeto: OptionalBool,
  options: z.array(SPPollOptionSchema).readonly(),
  votes: z.array(SPPollVoteSchema).readonly().optional(),
}) satisfies z.ZodType<SPPoll>;

export const SPPollKnownKeys: ReadonlySet<string> = knownKeysOf(SPPollSchema);

export const SPChannelCategorySchema = z.looseObject({
  _id: SPDocumentIdSchema,
  name: z.string().min(1),
  description: NullableString,
  order: OptionalNumber,
}) satisfies z.ZodType<SPChannelCategory>;

export const SPChannelCategoryKnownKeys: ReadonlySet<string> = knownKeysOf(SPChannelCategorySchema);

export const SPChannelSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  name: z.string().min(1),
  description: NullableString,
  parentCategory: z.string().min(1).nullable(),
  order: OptionalNumber,
}) satisfies z.ZodType<SPChannel>;

export const SPChannelKnownKeys: ReadonlySet<string> = knownKeysOf(SPChannelSchema);

export const SPChatMessageSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  channel: z.string().min(1),
  writer: z.string().min(1),
  message: z.string(),
  writtenAt: Timestamp,
  replyTo: NullableString,
}) satisfies z.ZodType<SPChatMessage>;

export const SPChatMessageKnownKeys: ReadonlySet<string> = knownKeysOf(SPChatMessageSchema);

export const SPBoardMessageSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  title: z.string(),
  message: z.string(),
  writer: z.string().min(1),
  writtenAt: Timestamp,
  readBy: z.array(z.string()).readonly().optional(),
}) satisfies z.ZodType<SPBoardMessage>;

export const SPBoardMessageKnownKeys: ReadonlySet<string> = knownKeysOf(SPBoardMessageSchema);

export const SPPrivacyBucketSchema = z.looseObject({
  _id: SPDocumentIdSchema,
  name: z.string().min(1),
  desc: NullableString,
  color: NullableString,
  icon: NullableString,
}) satisfies z.ZodType<SPPrivacyBucket>;

export const SPPrivacyBucketKnownKeys: ReadonlySet<string> = knownKeysOf(SPPrivacyBucketSchema);

export const SPImportPayloadSchema = z.looseObject({
  users: z.array(SPUserSchema).optional(),
  private: z.array(SPPrivateSchema).optional(),
  privacyBuckets: z.array(SPPrivacyBucketSchema).optional(),
  customFields: z.array(SPCustomFieldSchema).optional(),
  frontStatuses: z.array(SPFrontStatusSchema).optional(),
  members: z.array(SPMemberSchema).optional(),
  groups: z.array(SPGroupSchema).optional(),
  frontHistory: z.array(SPFrontHistorySchema).optional(),
  comments: z.array(SPCommentSchema).optional(),
  notes: z.array(SPNoteSchema).optional(),
  polls: z.array(SPPollSchema).optional(),
  channelCategories: z.array(SPChannelCategorySchema).optional(),
  channels: z.array(SPChannelSchema).optional(),
  chatMessages: z.array(SPChatMessageSchema).optional(),
  boardMessages: z.array(SPBoardMessageSchema).optional(),
});
