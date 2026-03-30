import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createFieldValueRoutes } from "../../../fields/create-field-value-routes.js";

import type { AuthEnv } from "../../../../lib/auth-context.js";

const { setRoute, listRoute, updateRoute, deleteRoute } = createFieldValueRoutes({
  ownerKind: "structureEntity",
  ownerParamName: "entityId",
  ownerIdPrefix: ID_PREFIXES.structureEntity,
});

export const entityFieldValueRoutes = new Hono<AuthEnv>();

// listRoute before routes with /:fieldDefId so GET / is not captured
entityFieldValueRoutes.route("/", listRoute);
entityFieldValueRoutes.route("/", setRoute);
entityFieldValueRoutes.route("/", updateRoute);
entityFieldValueRoutes.route("/", deleteRoute);
