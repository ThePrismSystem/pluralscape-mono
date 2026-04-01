import { authRouter } from "./routers/auth.js";
import { memberRouter } from "./routers/member.js";
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
  member: memberRouter,
});

export type AppRouter = typeof appRouter;
