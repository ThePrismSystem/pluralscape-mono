import { Hono } from "hono";

import { errorHandler } from "../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../middleware/request-id.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { Env } from "hono";

/** System ID used across all route tests. */
export const MOCK_SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

/** Shared auth context used across all route tests. */
export const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: MOCK_SYSTEM_ID as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([MOCK_SYSTEM_ID as AuthContext["systemId"] & string]),
};

/** Auth context for account-level routes with no active system (systemId: null). */
export const MOCK_ACCOUNT_ONLY_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: null,
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set<AuthContext["systemId"] & string>(),
};

/** Create a Hono app with request-id middleware, the given routes, and the error handler. */
export function createRouteApp<E extends Env>(mountPath: string, routes: Hono<E>): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route(mountPath, routes);
  app.onError(errorHandler);
  return app;
}

/** Send a POST request with a JSON body. */
export async function postJSON(app: Hono, url: string, body: unknown): Promise<Response> {
  return app.request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Send a PUT request with a JSON body. */
export async function putJSON(app: Hono, url: string, body: unknown): Promise<Response> {
  return app.request(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Send a PATCH request with a JSON body. */
export async function patchJSON(app: Hono, url: string, body: unknown): Promise<Response> {
  return app.request(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
