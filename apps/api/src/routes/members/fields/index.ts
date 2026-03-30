import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createFieldValueRoutes } from "../../fields/create-field-value-routes.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

const { setRoute, listRoute, updateRoute, deleteRoute } = createFieldValueRoutes({
  ownerKind: "member",
  ownerParamName: "memberId",
  ownerIdPrefix: ID_PREFIXES.member,
});

export const fieldValueRoutes = new Hono<AuthEnv>();

// listRoute before routes with /:fieldDefId so GET / is not captured
fieldValueRoutes.route("/", listRoute);
fieldValueRoutes.route("/", setRoute);
fieldValueRoutes.route("/", updateRoute);
fieldValueRoutes.route("/", deleteRoute);
