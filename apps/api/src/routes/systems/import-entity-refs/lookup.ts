import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND, HTTP_OK } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { lookupImportEntityRef } from "../../../services/import-entity-ref.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";
import type { ImportEntityType, ImportSource } from "@pluralscape/types";

const VALID_SOURCES: readonly ImportSource[] = ["simply-plural", "pluralkit", "pluralscape"];
const VALID_ENTITY_TYPES: readonly ImportEntityType[] = [
  "member",
  "group",
  "fronting-session",
  "switch",
  "custom-field",
  "note",
  "chat-message",
  "board-message",
  "poll",
  "timer",
  "privacy-bucket",
  "friend",
  "unknown",
];

export const lookupRoute = new Hono<AuthEnv>();

lookupRoute.use("*", createCategoryRateLimiter("readDefault"));

lookupRoute.get("/lookup", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);

  const source = c.req.query("source");
  const sourceEntityType = c.req.query("sourceEntityType");
  const sourceEntityId = c.req.query("sourceEntityId");

  if (
    !source ||
    !sourceEntityType ||
    !sourceEntityId ||
    !VALID_SOURCES.includes(source as ImportSource) ||
    !VALID_ENTITY_TYPES.includes(sourceEntityType as ImportEntityType)
  ) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid lookup parameters");
  }

  const db = await getDb();
  const result = await lookupImportEntityRef(
    db,
    systemId,
    {
      source: source as ImportSource,
      sourceEntityType: sourceEntityType as ImportEntityType,
      sourceEntityId,
    },
    auth,
  );

  if (!result) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Import entity ref not found");
  }

  return c.json(envelope(result), HTTP_OK);
});
