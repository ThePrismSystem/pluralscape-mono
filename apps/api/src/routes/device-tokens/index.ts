import { Hono } from "hono";

import { deleteRoute } from "./delete.js";
import { listRoute } from "./list.js";
import { registerRoute } from "./register.js";
import { revokeRoute } from "./revoke.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const deviceTokenRoutes = new Hono<AuthEnv>();

deviceTokenRoutes.route("/", listRoute);
deviceTokenRoutes.route("/", registerRoute);
deviceTokenRoutes.route("/", updateRoute);
deviceTokenRoutes.route("/", revokeRoute);
deviceTokenRoutes.route("/", deleteRoute);
