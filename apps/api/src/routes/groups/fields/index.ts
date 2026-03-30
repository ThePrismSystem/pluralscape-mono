import { Hono } from "hono";

import { deleteRoute } from "./delete.js";
import { listRoute } from "./list.js";
import { setRoute } from "./set.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const groupFieldValueRoutes = new Hono<AuthEnv>();

// listRoute before routes with /:fieldDefId so GET / is not captured
groupFieldValueRoutes.route("/", listRoute);
groupFieldValueRoutes.route("/", setRoute);
groupFieldValueRoutes.route("/", updateRoute);
groupFieldValueRoutes.route("/", deleteRoute);
