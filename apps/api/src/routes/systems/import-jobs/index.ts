import { Hono } from "hono";

import { createRoute } from "./create.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const importJobRoutes = new Hono<AuthEnv>();

importJobRoutes.route("/", listRoute);
importJobRoutes.route("/", getRoute);
importJobRoutes.route("/", createRoute);
importJobRoutes.route("/", updateRoute);
