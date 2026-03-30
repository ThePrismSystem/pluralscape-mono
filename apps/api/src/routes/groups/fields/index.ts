import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createFieldValueRoutes } from "../../fields/create-field-value-routes.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

const { setRoute, listRoute, updateRoute, deleteRoute } = createFieldValueRoutes({
  ownerKind: "group",
  ownerParamName: "groupId",
  ownerIdPrefix: ID_PREFIXES.group,
});

export const groupFieldValueRoutes = new Hono<AuthEnv>();

// listRoute before routes with /:fieldDefId so GET / is not captured
groupFieldValueRoutes.route("/", listRoute);
groupFieldValueRoutes.route("/", setRoute);
groupFieldValueRoutes.route("/", updateRoute);
groupFieldValueRoutes.route("/", deleteRoute);
