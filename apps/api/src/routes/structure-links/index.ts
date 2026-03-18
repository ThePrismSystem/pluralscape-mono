import { ID_PREFIXES, toCursor } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_CREATED, HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { parsePaginationLimit } from "../../lib/pagination.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";
import {
  createSideSystemLayerLink,
  createSubsystemLayerLink,
  createSubsystemSideSystemLink,
  deleteSideSystemLayerLink,
  deleteSubsystemLayerLink,
  deleteSubsystemSideSystemLink,
  listSideSystemLayerLinks,
  listSubsystemLayerLinks,
  listSubsystemSideSystemLinks,
} from "../../services/structure-link.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const structureLinkRoutes = new Hono<AuthEnv>();

// ── Subsystem ↔ Layer ──────────────────────────────────────────────

const slCreate = new Hono<AuthEnv>();
slCreate.use("*", createCategoryRateLimiter("write"));
slCreate.post("/subsystem-layer", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const db = await getDb();
  const result = await createSubsystemLayerLink(db, systemId, body, auth, audit);
  return c.json(result, HTTP_CREATED);
});

const slDelete = new Hono<AuthEnv>();
slDelete.use("*", createCategoryRateLimiter("write"));
slDelete.delete("/subsystem-layer/:linkId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const linkId = parseIdParam(c.req.param("linkId"), ID_PREFIXES.structureLink);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await deleteSubsystemLayerLink(db, systemId, linkId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});

const slList = new Hono<AuthEnv>();
slList.get("/subsystem-layer", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const subsystemId = c.req.query("subsystemId");
  const layerId = c.req.query("layerId");

  const db = await getDb();
  const result = await listSubsystemLayerLinks(
    db,
    systemId,
    auth,
    cursorParam ? toCursor(cursorParam) : undefined,
    limit,
    subsystemId,
    layerId,
  );
  return c.json(result);
});

// ── Subsystem ↔ Side System ────────────────────────────────────────

const ssCreate = new Hono<AuthEnv>();
ssCreate.use("*", createCategoryRateLimiter("write"));
ssCreate.post("/subsystem-side-system", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const db = await getDb();
  const result = await createSubsystemSideSystemLink(db, systemId, body, auth, audit);
  return c.json(result, HTTP_CREATED);
});

const ssDelete = new Hono<AuthEnv>();
ssDelete.use("*", createCategoryRateLimiter("write"));
ssDelete.delete("/subsystem-side-system/:linkId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const linkId = parseIdParam(c.req.param("linkId"), ID_PREFIXES.structureLink);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await deleteSubsystemSideSystemLink(db, systemId, linkId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});

const ssList = new Hono<AuthEnv>();
ssList.get("/subsystem-side-system", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const subsystemId = c.req.query("subsystemId");
  const sideSystemId = c.req.query("sideSystemId");

  const db = await getDb();
  const result = await listSubsystemSideSystemLinks(
    db,
    systemId,
    auth,
    cursorParam ? toCursor(cursorParam) : undefined,
    limit,
    subsystemId,
    sideSystemId,
  );
  return c.json(result);
});

// ── Side System ↔ Layer ────────────────────────────────────────────

const sslCreate = new Hono<AuthEnv>();
sslCreate.use("*", createCategoryRateLimiter("write"));
sslCreate.post("/side-system-layer", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const db = await getDb();
  const result = await createSideSystemLayerLink(db, systemId, body, auth, audit);
  return c.json(result, HTTP_CREATED);
});

const sslDelete = new Hono<AuthEnv>();
sslDelete.use("*", createCategoryRateLimiter("write"));
sslDelete.delete("/side-system-layer/:linkId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const linkId = parseIdParam(c.req.param("linkId"), ID_PREFIXES.structureLink);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await deleteSideSystemLayerLink(db, systemId, linkId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});

const sslList = new Hono<AuthEnv>();
sslList.get("/side-system-layer", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const sideSystemId = c.req.query("sideSystemId");
  const layerId = c.req.query("layerId");

  const db = await getDb();
  const result = await listSideSystemLayerLinks(
    db,
    systemId,
    auth,
    cursorParam ? toCursor(cursorParam) : undefined,
    limit,
    sideSystemId,
    layerId,
  );
  return c.json(result);
});

// Mount all routes
structureLinkRoutes.route("/", slList);
structureLinkRoutes.route("/", slCreate);
structureLinkRoutes.route("/", slDelete);
structureLinkRoutes.route("/", ssList);
structureLinkRoutes.route("/", ssCreate);
structureLinkRoutes.route("/", ssDelete);
structureLinkRoutes.route("/", sslList);
structureLinkRoutes.route("/", sslCreate);
structureLinkRoutes.route("/", sslDelete);
