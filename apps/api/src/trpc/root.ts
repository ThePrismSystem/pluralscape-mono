import { acknowledgementRouter } from "./routers/acknowledgement.js";
import { analyticsRouter } from "./routers/analytics.js";
import { authRouter } from "./routers/auth.js";
import { boardMessageRouter } from "./routers/board-message.js";
import { bucketRouter } from "./routers/bucket.js";
import { channelRouter } from "./routers/channel.js";
import { checkInRecordRouter } from "./routers/check-in-record.js";
import { customFrontRouter } from "./routers/custom-front.js";
import { fieldRouter } from "./routers/field.js";
import { frontingCommentRouter } from "./routers/fronting-comment.js";
import { frontingReportRouter } from "./routers/fronting-report.js";
import { frontingSessionRouter } from "./routers/fronting-session.js";
import { groupRouter } from "./routers/group.js";
import { innerworldRouter } from "./routers/innerworld.js";
import { lifecycleEventRouter } from "./routers/lifecycle-event.js";
import { memberPhotoRouter } from "./routers/member-photo.js";
import { memberRouter } from "./routers/member.js";
import { messageRouter } from "./routers/message.js";
import { noteRouter } from "./routers/note.js";
import { pollRouter } from "./routers/poll.js";
import { relationshipRouter } from "./routers/relationship.js";
import { systemSettingsRouter } from "./routers/system-settings.js";
import { systemRouter } from "./routers/system.js";
import { router } from "./trpc.js";

/**
 * Root tRPC router. All domain routers are composed here.
 *
 * To add a new domain router:
 * 1. Create `routers/<domain>.ts` following the member router pattern
 * 2. Import and add it here
 */
export const appRouter = router({
  acknowledgement: acknowledgementRouter,
  analytics: analyticsRouter,
  auth: authRouter,
  boardMessage: boardMessageRouter,
  bucket: bucketRouter,
  channel: channelRouter,
  checkInRecord: checkInRecordRouter,
  customFront: customFrontRouter,
  field: fieldRouter,
  frontingComment: frontingCommentRouter,
  frontingReport: frontingReportRouter,
  frontingSession: frontingSessionRouter,
  group: groupRouter,
  innerworld: innerworldRouter,
  lifecycleEvent: lifecycleEventRouter,
  member: memberRouter,
  memberPhoto: memberPhotoRouter,
  message: messageRouter,
  note: noteRouter,
  poll: pollRouter,
  relationship: relationshipRouter,
  system: systemRouter,
  systemSettings: systemSettingsRouter,
});

export type AppRouter = typeof appRouter;
