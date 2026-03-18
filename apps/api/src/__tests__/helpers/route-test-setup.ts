import { Hono } from "hono";

import { errorHandler } from "../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../middleware/request-id.js";

import type { AuthContext, AuthEnv } from "../../lib/auth-context.js";

/** Shared auth context used across all route tests. */
export const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
};

/** Create a Hono app with request-id middleware, the given routes, and the error handler. */
export function createRouteApp(mountPath: string, routes: Hono<AuthEnv>): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route(mountPath, routes);
  app.onError(errorHandler);
  return app;
}
