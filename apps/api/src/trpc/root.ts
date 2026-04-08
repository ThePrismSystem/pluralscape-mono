import { accountRouter } from "./routers/account.js";
import { acknowledgementRouter } from "./routers/acknowledgement.js";
import { analyticsRouter } from "./routers/analytics.js";
import { apiKeyRouter } from "./routers/api-key.js";
import { authRouter } from "./routers/auth.js";
import { blobRouter } from "./routers/blob.js";
import { boardMessageRouter } from "./routers/board-message.js";
import { bucketRouter } from "./routers/bucket.js";
import { channelRouter } from "./routers/channel.js";
import { checkInRecordRouter } from "./routers/check-in-record.js";
import { customFrontRouter } from "./routers/custom-front.js";
import { deviceTokenRouter } from "./routers/device-token.js";
import { fieldRouter } from "./routers/field.js";
import { friendCodeRouter } from "./routers/friend-code.js";
import { friendRouter } from "./routers/friend.js";
import { frontingCommentRouter } from "./routers/fronting-comment.js";
import { frontingReportRouter } from "./routers/fronting-report.js";
import { frontingSessionRouter } from "./routers/fronting-session.js";
import { groupRouter } from "./routers/group.js";
import { importEntityRefRouter } from "./routers/import-entity-ref.js";
import { importJobRouter } from "./routers/import-job.js";
import { innerworldRouter } from "./routers/innerworld.js";
import { lifecycleEventRouter } from "./routers/lifecycle-event.js";
import { memberPhotoRouter } from "./routers/member-photo.js";
import { memberRouter } from "./routers/member.js";
import { messageRouter } from "./routers/message.js";
import { noteRouter } from "./routers/note.js";
import { notificationConfigRouter } from "./routers/notification-config.js";
import { pollRouter } from "./routers/poll.js";
import { relationshipRouter } from "./routers/relationship.js";
import { snapshotRouter } from "./routers/snapshot.js";
import { structureRouter } from "./routers/structure.js";
import { systemSettingsRouter } from "./routers/system-settings.js";
import { systemRouter } from "./routers/system.js";
import { timerConfigRouter } from "./routers/timer-config.js";
import { webhookConfigRouter } from "./routers/webhook-config.js";
import { webhookDeliveryRouter } from "./routers/webhook-delivery.js";
import { router } from "./trpc.js";

/**
 * Root tRPC router. All domain routers are composed here.
 *
 * To add a new domain router:
 * 1. Create `routers/<domain>.ts` following the member router pattern
 * 2. Import and add it here
 */
export const appRouter = router({
  account: accountRouter,
  acknowledgement: acknowledgementRouter,
  analytics: analyticsRouter,
  apiKey: apiKeyRouter,
  auth: authRouter,
  blob: blobRouter,
  boardMessage: boardMessageRouter,
  bucket: bucketRouter,
  channel: channelRouter,
  checkInRecord: checkInRecordRouter,
  customFront: customFrontRouter,
  deviceToken: deviceTokenRouter,
  field: fieldRouter,
  friend: friendRouter,
  friendCode: friendCodeRouter,
  frontingComment: frontingCommentRouter,
  frontingReport: frontingReportRouter,
  frontingSession: frontingSessionRouter,
  group: groupRouter,
  importEntityRef: importEntityRefRouter,
  importJob: importJobRouter,
  innerworld: innerworldRouter,
  lifecycleEvent: lifecycleEventRouter,
  member: memberRouter,
  memberPhoto: memberPhotoRouter,
  message: messageRouter,
  note: noteRouter,
  notificationConfig: notificationConfigRouter,
  poll: pollRouter,
  relationship: relationshipRouter,
  snapshot: snapshotRouter,
  structure: structureRouter,
  system: systemRouter,
  systemSettings: systemSettingsRouter,
  timerConfig: timerConfigRouter,
  webhookConfig: webhookConfigRouter,
  webhookDelivery: webhookDeliveryRouter,
});

export type AppRouter = typeof appRouter;
