import { Hono } from "hono";

import { ApiHttpError } from "../../lib/api-error.js";
import { getDb } from "../../lib/db.js";
import { getSystemProfile } from "../../services/system.service.js";

import { HTTP_BAD_REQUEST } from "./systems.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const systemId = c.req.param("id");

  if (!systemId) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "System ID is required");
  }

  const db = await getDb();
  const result = await getSystemProfile(db, systemId, auth);
  return c.json(result);
});
