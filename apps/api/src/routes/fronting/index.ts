import { Hono } from "hono";

import { activeRoute } from "./active.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const frontingRoutes = new Hono<AuthEnv>();

frontingRoutes.route("/active", activeRoute);
