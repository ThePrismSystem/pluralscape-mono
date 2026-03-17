import { Hono } from "hono";

import { deleteRoute } from "./delete.js";
import { listRoute } from "./list.js";
import { setRoute } from "./set.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const fieldValueRoutes = new Hono<AuthEnv>();

// listRoute before routes with /:fieldDefId so GET / is not captured
fieldValueRoutes.route("/", listRoute);
fieldValueRoutes.route("/", setRoute);
fieldValueRoutes.route("/", updateRoute);
fieldValueRoutes.route("/", deleteRoute);
