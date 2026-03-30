import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_CREATED, HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import {
  deleteFieldValueForOwner,
  listFieldValuesForOwner,
  setFieldValueForOwner,
  updateFieldValueForOwner,
} from "../../services/field-value.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";
import type { FieldValueOwner } from "../../services/field-value.service.js";
import type {
  GroupId,
  IdPrefixBrandMap,
  MemberId,
  SystemStructureEntityId,
} from "@pluralscape/types";

interface FieldValueRouteConfig {
  /** Discriminant passed to the service layer ("member" | "group" | "structureEntity") */
  ownerKind: FieldValueOwner["kind"];
  /** Name of the Hono route parameter carrying the owner id (e.g. "memberId") */
  ownerParamName: string;
  /** Prefix key used to validate the owner id (e.g. ID_PREFIXES.member) */
  ownerIdPrefix: keyof IdPrefixBrandMap;
}

interface FieldValueRoutes {
  setRoute: Hono<AuthEnv>;
  listRoute: Hono<AuthEnv>;
  updateRoute: Hono<AuthEnv>;
  deleteRoute: Hono<AuthEnv>;
}

function toFieldValueOwner(kind: FieldValueOwner["kind"], id: string): FieldValueOwner {
  switch (kind) {
    case "member":
      return { kind, id: id as MemberId };
    case "group":
      return { kind, id: id as GroupId };
    case "structureEntity":
      return { kind, id: id as SystemStructureEntityId };
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unknown owner kind: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Generates the four field-value CRUD routes (set, list, update, delete)
 * for a given owner type. Each owner (member, group, structureEntity) uses
 * identical logic differing only in param name and id prefix.
 */
export function createFieldValueRoutes(config: FieldValueRouteConfig): FieldValueRoutes {
  const { ownerKind, ownerParamName, ownerIdPrefix } = config;

  const resolveOwner = (paramValue: string | undefined): FieldValueOwner => {
    const id = requireIdParam(paramValue, ownerParamName, ownerIdPrefix);
    return toFieldValueOwner(ownerKind, id);
  };

  // ── SET (POST /:fieldDefId) ─────────────────────────────────────
  const setRoute = new Hono<AuthEnv>();
  setRoute.use("*", createCategoryRateLimiter("write"));
  setRoute.post("/:fieldDefId", async (c) => {
    const body = await parseJsonBody(c);
    const auth = c.get("auth");
    const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
    const owner = resolveOwner(c.req.param(ownerParamName));
    const fieldDefId = parseIdParam(c.req.param("fieldDefId"), ID_PREFIXES.fieldDefinition);
    const audit = createAuditWriter(c, auth);

    const db = await getDb();
    const result = await setFieldValueForOwner(db, systemId, owner, fieldDefId, body, auth, audit);
    return c.json(envelope(result), HTTP_CREATED);
  });

  // ── LIST (GET /) ────────────────────────────────────────────────
  const listRoute = new Hono<AuthEnv>();
  listRoute.use("*", createCategoryRateLimiter("readDefault"));
  listRoute.get("/", async (c) => {
    const auth = c.get("auth");
    const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
    const owner = resolveOwner(c.req.param(ownerParamName));

    const db = await getDb();
    const result = await listFieldValuesForOwner(db, systemId, owner, auth);
    return c.json(envelope(result));
  });

  // ── UPDATE (PUT /:fieldDefId) ───────────────────────────────────
  const updateRoute = new Hono<AuthEnv>();
  updateRoute.use("*", createCategoryRateLimiter("write"));
  updateRoute.put("/:fieldDefId", async (c) => {
    const body = await parseJsonBody(c);
    const auth = c.get("auth");
    const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
    const owner = resolveOwner(c.req.param(ownerParamName));
    const fieldDefId = parseIdParam(c.req.param("fieldDefId"), ID_PREFIXES.fieldDefinition);
    const audit = createAuditWriter(c, auth);

    const db = await getDb();
    const result = await updateFieldValueForOwner(
      db,
      systemId,
      owner,
      fieldDefId,
      body,
      auth,
      audit,
    );
    return c.json(envelope(result));
  });

  // ── DELETE (DELETE /:fieldDefId) ────────────────────────────────
  const deleteRoute = new Hono<AuthEnv>();
  deleteRoute.use("*", createCategoryRateLimiter("write"));
  deleteRoute.delete("/:fieldDefId", async (c) => {
    const auth = c.get("auth");
    const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
    const owner = resolveOwner(c.req.param(ownerParamName));
    const fieldDefId = parseIdParam(c.req.param("fieldDefId"), ID_PREFIXES.fieldDefinition);
    const audit = createAuditWriter(c, auth);

    const db = await getDb();
    await deleteFieldValueForOwner(db, systemId, owner, fieldDefId, auth, audit);
    return c.body(null, HTTP_NO_CONTENT);
  });

  return { setRoute, listRoute, updateRoute, deleteRoute };
}
