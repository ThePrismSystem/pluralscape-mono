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
  addSubsystemMembership,
  listSubsystemMemberships,
  removeSubsystemMembership,
} from "../../../services/structure-membership.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const subsystemMembershipRoutes = new Hono<AuthEnv>();

const addRoute = new Hono<AuthEnv>();
addRoute.use("*", createCategoryRateLimiter("write"));
addRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const subsystemId = requireIdParam(
    c.req.param("subsystemId"),
    "subsystemId",
    ID_PREFIXES.subsystem,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await addSubsystemMembership(db, systemId, subsystemId, body, auth, audit);
  return c.json(result, HTTP_CREATED);
});

const removeRoute = new Hono<AuthEnv>();
removeRoute.use("*", createCategoryRateLimiter("write"));
removeRoute.delete("/:membershipId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const membershipId = parseIdParam(c.req.param("membershipId"), ID_PREFIXES.subsystemMembership);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await removeSubsystemMembership(db, systemId, membershipId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});

const listRoute = new Hono<AuthEnv>();
listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const subsystemId = requireIdParam(
    c.req.param("subsystemId"),
    "subsystemId",
    ID_PREFIXES.subsystem,
  );
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  const db = await getDb();
  const result = await listSubsystemMemberships(
    db,
    systemId,
    subsystemId,
    auth,
    cursorParam ? toCursor(cursorParam) : undefined,
    limit,
  );
  return c.json(result);
});

subsystemMembershipRoutes.route("/", listRoute);
subsystemMembershipRoutes.route("/", removeRoute);
subsystemMembershipRoutes.route("/", addRoute);
