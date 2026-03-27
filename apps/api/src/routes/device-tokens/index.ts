import { Hono } from "hono";

import { listRoute } from "./list.js";
import { registerRoute } from "./register.js";
import { revokeRoute } from "./revoke.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const deviceTokenRoutes = new Hono<AuthEnv>();

deviceTokenRoutes.route("/", listRoute);
deviceTokenRoutes.route("/", registerRoute);
deviceTokenRoutes.route("/", revokeRoute);
