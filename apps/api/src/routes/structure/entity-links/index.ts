import { Hono } from "hono";

import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { listRoute } from "./list.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const entityLinkRoutes = new Hono<AuthEnv>();

entityLinkRoutes.route("/", listRoute);
entityLinkRoutes.route("/", createRoute);
entityLinkRoutes.route("/", deleteRoute);
