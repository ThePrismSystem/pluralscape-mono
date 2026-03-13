import { getDeploymentMode } from "@pluralscape/db";

import type { MiddlewareHandler } from "hono";

const HTTP_FORBIDDEN = 403;

/**
 * Hono middleware that blocks requests in hosted mode.
 * Returns 403 Forbidden for routes that should only be accessible on self-hosted deployments.
 */
export const requireSelfHosted: MiddlewareHandler = async (c, next) => {
  if (getDeploymentMode() === "hosted") {
    return c.json(
      { error: "This endpoint is only available on self-hosted deployments" },
      HTTP_FORBIDDEN,
    );
  }
  return next();
};
