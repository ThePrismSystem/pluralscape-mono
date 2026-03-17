import { Hono } from "hono";

import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const groupRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:groupId
groupRoutes.route("/", listRoute);
groupRoutes.route("/", getRoute);
groupRoutes.route("/", updateRoute);
groupRoutes.route("/", deleteRoute);
groupRoutes.route("/", createRoute);
