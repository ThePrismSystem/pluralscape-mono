import { Hono } from "hono";

import { errorHandler } from "../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../middleware/request-id.js";

import type { Env } from "hono";

export { MOCK_AUTH, MOCK_ACCOUNT_ONLY_AUTH, MOCK_SYSTEM_ID } from "./shared-mocks.js";

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
