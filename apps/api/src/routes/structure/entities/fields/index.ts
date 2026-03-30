import { Hono } from "hono";

import { deleteRoute } from "./delete.js";
import { listRoute } from "./list.js";
import { setRoute } from "./set.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../../../lib/auth-context.js";

export const entityFieldValueRoutes = new Hono<AuthEnv>();

// listRoute before routes with /:fieldDefId so GET / is not captured
entityFieldValueRoutes.route("/", listRoute);
entityFieldValueRoutes.route("/", setRoute);
entityFieldValueRoutes.route("/", updateRoute);
entityFieldValueRoutes.route("/", deleteRoute);
