import { Hono } from "hono";

import { listRoute } from "./list.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const notificationConfigRoutes = new Hono<AuthEnv>();

notificationConfigRoutes.route("/", listRoute);
notificationConfigRoutes.route("/", updateRoute);
