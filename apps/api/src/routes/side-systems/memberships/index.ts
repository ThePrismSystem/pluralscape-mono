import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_CREATED, HTTP_NO_CONTENT } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../../lib/pagination.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";
import {
  addSideSystemMembership,
  listSideSystemMemberships,
  removeSideSystemMembership,
} from "../../../services/structure-membership.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const sideSystemMembershipRoutes = new Hono<AuthEnv>();

const addRoute = new Hono<AuthEnv>();
addRoute.use("*", createCategoryRateLimiter("write"));
addRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const sideSystemId = requireIdParam(
    c.req.param("sideSystemId"),
    "sideSystemId",
    ID_PREFIXES.sideSystem,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await addSideSystemMembership(db, systemId, sideSystemId, body, auth, audit);
  return c.json(result, HTTP_CREATED);
});

const removeRoute = new Hono<AuthEnv>();
removeRoute.use("*", createCategoryRateLimiter("write"));
removeRoute.delete("/:membershipId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const membershipId = parseIdParam(c.req.param("membershipId"), ID_PREFIXES.sideSystemMembership);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await removeSideSystemMembership(db, systemId, membershipId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});

const listRoute = new Hono<AuthEnv>();
listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const sideSystemId = requireIdParam(
    c.req.param("sideSystemId"),
    "sideSystemId",
    ID_PREFIXES.sideSystem,
  );
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  const db = await getDb();
  const result = await listSideSystemMemberships(
    db,
    systemId,
    sideSystemId,
    auth,
    parseCursor(cursorParam),
    limit,
  );
  return c.json(result);
});

sideSystemMembershipRoutes.route("/", listRoute);
sideSystemMembershipRoutes.route("/", removeRoute);
sideSystemMembershipRoutes.route("/", addRoute);
