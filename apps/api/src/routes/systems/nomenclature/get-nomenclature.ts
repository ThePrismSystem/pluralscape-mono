import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireParam } from "../../../lib/id-param.js";
import { getNomenclatureSettings } from "../../../services/nomenclature.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const getNomenclatureRoute = new Hono<AuthEnv>();

getNomenclatureRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(requireParam(c.req.param("id"), "id"), ID_PREFIXES.system);

  const db = await getDb();
  const result = await getNomenclatureSettings(db, systemId, auth);
  return c.json(result);
});
