import { Hono } from "hono";

import { createRoute } from "./create.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { revokeRoute } from "./revoke.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const apiKeyRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:apiKeyId
apiKeyRoutes.route("/", listRoute);
apiKeyRoutes.route("/", getRoute);
apiKeyRoutes.route("/", createRoute);
apiKeyRoutes.route("/", revokeRoute);
