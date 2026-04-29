import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateCanvasBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { getCanvas, upsertCanvas } from "../../../services/innerworld/canvas.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const canvasRoutes = new Hono<AuthEnv>();

const canvasReadRoutes = new Hono<AuthEnv>();
canvasReadRoutes.use("*", createCategoryRateLimiter("readDefault"));

canvasReadRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);

  const db = await getDb();
  const result = await getCanvas(db, systemId, auth);
  return c.json(envelope(result));
});

canvasRoutes.route("/", canvasReadRoutes);

const canvasWriteRoutes = new Hono<AuthEnv>();
canvasWriteRoutes.use("*", createCategoryRateLimiter("write"));

canvasWriteRoutes.put("/", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = UpdateCanvasBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await upsertCanvas(db, systemId, parsed.data, auth, audit);
  return c.json(envelope(result));
});

canvasRoutes.route("/", canvasWriteRoutes);
