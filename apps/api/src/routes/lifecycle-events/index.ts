import { Hono } from "hono";

import { createRoute } from "./create.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const lifecycleEventRoutes = new Hono<AuthEnv>();

lifecycleEventRoutes.route("/", listRoute);
lifecycleEventRoutes.route("/", getRoute);
lifecycleEventRoutes.route("/", createRoute);
