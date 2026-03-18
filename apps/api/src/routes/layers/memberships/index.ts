import { ID_PREFIXES, toCursor } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_CREATED, HTTP_NO_CONTENT } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { parsePaginationLimit } from "../../../lib/pagination.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";
import {
  addLayerMembership,
  listLayerMemberships,
  removeLayerMembership,
} from "../../../services/structure-membership.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const layerMembershipRoutes = new Hono<AuthEnv>();

const addRoute = new Hono<AuthEnv>();
addRoute.use("*", createCategoryRateLimiter("write"));
addRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const layerId = requireIdParam(c.req.param("layerId"), "layerId", ID_PREFIXES.layer);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await addLayerMembership(db, systemId, layerId, body, auth, audit);
  return c.json(result, HTTP_CREATED);
});

const removeRoute = new Hono<AuthEnv>();
removeRoute.use("*", createCategoryRateLimiter("write"));
removeRoute.delete("/:membershipId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const membershipId = parseIdParam(c.req.param("membershipId"), ID_PREFIXES.layerMembership);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await removeLayerMembership(db, systemId, membershipId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});

const listRoute = new Hono<AuthEnv>();
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const layerId = requireIdParam(c.req.param("layerId"), "layerId", ID_PREFIXES.layer);
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  const db = await getDb();
  const result = await listLayerMemberships(
    db,
    systemId,
    layerId,
    auth,
    cursorParam ? toCursor(cursorParam) : undefined,
    limit,
  );
  return c.json(result);
});

layerMembershipRoutes.route("/", listRoute);
layerMembershipRoutes.route("/", removeRoute);
layerMembershipRoutes.route("/", addRoute);
