export { createAppQueryClient } from "./query-client.js";
export { createCrdtQueryBridge } from "./crdt-query-bridge.js";
export type { CrdtDocumentQueryOpts, DocumentSnapshotProvider } from "./crdt-query-bridge.js";
export type { paths } from "@pluralscape/api-client";
export { createRestQueryFactory } from "./rest-query-factory.js";
export type {
  RestQueryFactoryDeps,
  RestQueryOptsWithDecrypt,
  RestQueryOptsPlain,
} from "./rest-query-factory.js";

// --- Blob decode/encode ---
export {
  decodeAndDecryptT1,
  encryptAndEncodeT1,
  encryptInput,
  encryptUpdate,
} from "./transforms/decode-blob.js";

// --- Domain crypto transforms ---
export {
  decryptMember,
  decryptMemberPage,
  encryptMemberInput,
  encryptMemberUpdate,
} from "./transforms/member.js";
export type { MemberEncryptedFields } from "./transforms/member.js";

export {
  decryptGroup,
  decryptGroupPage,
  encryptGroupInput,
  encryptGroupUpdate,
} from "./transforms/group.js";
export type { GroupEncryptedFields } from "./transforms/group.js";

export {
  decryptCustomFront,
  decryptCustomFrontPage,
  encryptCustomFrontInput,
  encryptCustomFrontUpdate,
} from "./transforms/custom-front.js";
export type { CustomFrontEncryptedFields } from "./transforms/custom-front.js";

export {
  decryptFieldDefinition,
  decryptFieldDefinitionPage,
  encryptFieldDefinitionInput,
  decryptFieldValue,
  decryptFieldValueList,
  encryptFieldValueInput,
} from "./transforms/custom-field.js";
export type {
  FieldDefinitionEncryptedFields,
  FieldValueDecrypted,
} from "./transforms/custom-field.js";

export {
  decryptSystemSettings,
  encryptSystemSettingsUpdate,
  decryptNomenclature,
  encryptNomenclatureUpdate,
} from "./transforms/system-settings.js";
export type { DecryptedNomenclature } from "./transforms/system-settings.js";

export {
  decryptFrontingSession,
  decryptFrontingSessionPage,
  encryptFrontingSessionInput,
  encryptFrontingSessionUpdate,
} from "./transforms/fronting-session.js";
export type { FrontingSessionEncryptedFields } from "./transforms/fronting-session.js";

export {
  decryptFrontingComment,
  decryptFrontingCommentPage,
  encryptFrontingCommentInput,
  encryptFrontingCommentUpdate,
} from "./transforms/fronting-comment.js";
export type { FrontingCommentEncryptedFields } from "./transforms/fronting-comment.js";

export {
  decryptFrontingReport,
  decryptFrontingReportPage,
  encryptFrontingReportInput,
} from "./transforms/fronting-report.js";
export type { FrontingReportEncryptedFields } from "./transforms/fronting-report.js";

export {
  decryptTimerConfig,
  decryptTimerConfigPage,
  encryptTimerConfigInput,
  encryptTimerConfigUpdate,
  decryptCheckInRecord,
  decryptCheckInRecordPage,
} from "./transforms/timer-check-in.js";
export type { TimerConfigEncryptedFields } from "./transforms/timer-check-in.js";

// --- Communication crypto transforms ---
export {
  decryptChannel,
  decryptChannelPage,
  encryptChannelInput,
  encryptChannelUpdate,
} from "./transforms/channel.js";
export type { ChannelEncryptedFields } from "./transforms/channel.js";

export {
  decryptMessage,
  decryptMessagePage,
  encryptMessageInput,
  encryptMessageUpdate,
} from "./transforms/message.js";
export type { MessageEncryptedFields } from "./transforms/message.js";

export {
  decryptBoardMessage,
  decryptBoardMessagePage,
  encryptBoardMessageInput,
  encryptBoardMessageUpdate,
} from "./transforms/board-message.js";
export type { BoardMessageEncryptedFields } from "./transforms/board-message.js";

export {
  decryptPoll,
  decryptPollPage,
  decryptPollVote,
  encryptPollInput,
  encryptPollUpdate,
  encryptPollVoteInput,
} from "./transforms/poll.js";
export type {
  PollDecrypted,
  PollEncryptedFields,
  PollVoteDecrypted,
  PollVoteEncryptedFields,
} from "./transforms/poll.js";

export {
  decryptNote,
  decryptNotePage,
  encryptNoteInput,
  encryptNoteUpdate,
} from "./transforms/note.js";
export type { NoteDecrypted, NoteEncryptedFields } from "./transforms/note.js";

export {
  decryptAcknowledgement,
  decryptAcknowledgementPage,
  encryptAcknowledgementInput,
  encryptAcknowledgementUpdate,
  encryptAcknowledgementConfirm,
} from "./transforms/acknowledgement.js";
export type { AcknowledgementEncryptedFields } from "./transforms/acknowledgement.js";
