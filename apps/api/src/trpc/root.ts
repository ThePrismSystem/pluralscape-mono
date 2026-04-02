import { authRouter } from "./routers/auth.js";
import { bucketRouter } from "./routers/bucket.js";
import { customFrontRouter } from "./routers/custom-front.js";
import { fieldRouter } from "./routers/field.js";
import { frontingSessionRouter } from "./routers/fronting-session.js";
import { groupRouter } from "./routers/group.js";
import { memberPhotoRouter } from "./routers/member-photo.js";
import { memberRouter } from "./routers/member.js";
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
  auth: authRouter,
  bucket: bucketRouter,
  customFront: customFrontRouter,
  field: fieldRouter,
  frontingSession: frontingSessionRouter,
  group: groupRouter,
  member: memberRouter,
  memberPhoto: memberPhotoRouter,
  system: systemRouter,
});

export type AppRouter = typeof appRouter;
