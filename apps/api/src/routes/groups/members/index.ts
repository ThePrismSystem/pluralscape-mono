import { Hono } from "hono";

import { addRoute } from "./add.js";
import { listRoute } from "./list.js";
import { removeRoute } from "./remove.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const memberRoutes = new Hono<AuthEnv>();

memberRoutes.route("/", listRoute);
memberRoutes.route("/", removeRoute);
memberRoutes.route("/", addRoute);
