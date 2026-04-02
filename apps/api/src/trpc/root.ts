import { authRouter } from "./routers/auth.js";
import { groupRouter } from "./routers/group.js";
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
  group: groupRouter,
  member: memberRouter,
  system: systemRouter,
});

export type AppRouter = typeof appRouter;
