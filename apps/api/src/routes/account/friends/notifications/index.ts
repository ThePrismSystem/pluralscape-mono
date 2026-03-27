import { Hono } from "hono";

import { getRoute } from "./get.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../../../lib/auth-context.js";

export const friendNotificationRoutes = new Hono<AuthEnv>();

friendNotificationRoutes.route("/", getRoute);
friendNotificationRoutes.route("/", updateRoute);
