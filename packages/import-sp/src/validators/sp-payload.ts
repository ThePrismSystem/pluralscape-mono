import { z } from "zod/v4";

import type {
  SPBoardMessage,
  SPChannel,
  SPChannelCategory,
  SPChatMessage,
  SPComment,
  SPCustomField,
  SPFriend,
  SPFrontHistory,
  SPFrontStatus,
  SPGroup,
  SPMember,
  SPNote,
  SPPendingFriendRequest,
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

export const SPUserSchema = z
  .object({
    _id: SPDocumentIdSchema,
    username: z.string().min(1),
    desc: NullableString,
    avatarUrl: NullableString,
    color: NullableString,
    defaultPrivacyBucket: NullableString,
  })
  .strip() satisfies z.ZodType<SPUser>;

export const SPPrivateSchema = z
  .object({
    _id: SPDocumentIdSchema,
    locale: NullableString,
    frontNotifs: OptionalBool,
    messageBoardNotifs: OptionalBool,
  })
  .strip() satisfies z.ZodType<SPPrivate>;

export const SPMemberSchema = z
  .object({
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
  })
  .strip() satisfies z.ZodType<SPMember>;

export const SPFrontStatusSchema = z
  .object({
    _id: SPDocumentIdSchema,
    name: z.string().min(1),
    desc: NullableString,
    color: NullableString,
    avatarUrl: NullableString,
    preventTrusted: OptionalBool,
    private: OptionalBool,
  })
  .strip() satisfies z.ZodType<SPFrontStatus>;

export const SPGroupSchema = z
  .object({
    _id: SPDocumentIdSchema,
    name: z.string().min(1),
    desc: NullableString,
    color: NullableString,
    parent: NullableString,
    members: z.array(z.string()).readonly(),
    preventTrusted: OptionalBool,
    private: OptionalBool,
  })
  .strip() satisfies z.ZodType<SPGroup>;

export const SPCustomFieldSchema = z
  .object({
    _id: SPDocumentIdSchema,
    name: z.string().min(1),
    type: z.string().min(1),
    order: NonNegInt,
    preventTrusted: OptionalBool,
    private: OptionalBool,
    supportMarkdown: OptionalBool,
  })
  .strip() satisfies z.ZodType<SPCustomField>;

export const SPFrontHistorySchema = z
  .object({
    _id: SPDocumentIdSchema,
    member: z.string().min(1),
    custom: z.boolean(),
    live: z.boolean(),
    startTime: Timestamp,
    endTime: z.number().nonnegative().nullable(),
    customStatus: NullableString,
  })
  .strip() satisfies z.ZodType<SPFrontHistory>;

export const SPCommentSchema = z
  .object({
    _id: SPDocumentIdSchema,
    documentId: z.string().min(1),
    text: z.string(),
    time: Timestamp,
  })
  .strip() satisfies z.ZodType<SPComment>;

export const SPNoteSchema = z
  .object({
    _id: SPDocumentIdSchema,
    title: z.string(),
    note: z.string(),
    date: Timestamp,
    color: NullableString,
    member: z.string().min(1),
    supportMarkdown: OptionalBool,
  })
  .strip() satisfies z.ZodType<SPNote>;

const SPPollOptionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    color: NullableString,
  })
  .strip() satisfies z.ZodType<SPPollOption>;

const SPPollVoteSchema = z
  .object({
    id: z.string().min(1),
    comment: NullableString,
    vote: z.string().min(1),
  })
  .strip() satisfies z.ZodType<SPPollVote>;

export const SPPollSchema = z
  .object({
    _id: SPDocumentIdSchema,
    name: z.string().min(1),
    desc: NullableString,
    endTime: z.number().nonnegative().nullable().optional(),
    custom: OptionalBool,
    allowAbstain: OptionalBool,
    allowVeto: OptionalBool,
    options: z.array(SPPollOptionSchema).readonly(),
    votes: z.array(SPPollVoteSchema).readonly().optional(),
  })
  .strip() satisfies z.ZodType<SPPoll>;

export const SPChannelCategorySchema = z
  .object({
    _id: SPDocumentIdSchema,
    name: z.string().min(1),
    description: NullableString,
    order: OptionalNumber,
  })
  .strip() satisfies z.ZodType<SPChannelCategory>;

export const SPChannelSchema = z
  .object({
    _id: SPDocumentIdSchema,
    name: z.string().min(1),
    description: NullableString,
    parentCategory: z.string().min(1).nullable(),
    order: OptionalNumber,
  })
  .strip() satisfies z.ZodType<SPChannel>;

export const SPChatMessageSchema = z
  .object({
    _id: SPDocumentIdSchema,
    channel: z.string().min(1),
    writer: z.string().min(1),
    message: z.string(),
    writtenAt: Timestamp,
    replyTo: NullableString,
  })
  .strip() satisfies z.ZodType<SPChatMessage>;

export const SPBoardMessageSchema = z
  .object({
    _id: SPDocumentIdSchema,
    title: z.string(),
    message: z.string(),
    writer: z.string().min(1),
    writtenAt: Timestamp,
    readBy: z.array(z.string()).readonly().optional(),
  })
  .strip() satisfies z.ZodType<SPBoardMessage>;

export const SPPrivacyBucketSchema = z
  .object({
    _id: SPDocumentIdSchema,
    name: z.string().min(1),
    desc: NullableString,
    color: NullableString,
    icon: NullableString,
  })
  .strip() satisfies z.ZodType<SPPrivacyBucket>;

export const SPFriendSchema = z
  .object({
    _id: SPDocumentIdSchema,
    frienduid: z.string().min(1),
    seenSources: z.array(z.string()).readonly().optional(),
    seeMembers: OptionalBool,
    seeFront: OptionalBool,
    trusted: OptionalBool,
    getFrontNotif: OptionalBool,
  })
  .strip() satisfies z.ZodType<SPFriend>;

export const SPPendingFriendRequestSchema = z
  .object({
    _id: SPDocumentIdSchema,
    sender: z.string().min(1),
    receiver: z.string().min(1),
    time: Timestamp,
    message: NullableString,
  })
  .strip() satisfies z.ZodType<SPPendingFriendRequest>;

export const SPImportPayloadSchema = z
  .object({
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
    friends: z.array(SPFriendSchema).optional(),
    pendingFriendRequests: z.array(SPPendingFriendRequestSchema).optional(),
  })
  .strip();
