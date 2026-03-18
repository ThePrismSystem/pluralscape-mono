import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const regionRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:regionId
regionRoutes.route("/", listRoute);
regionRoutes.route("/", getRoute);
regionRoutes.route("/", createRoute);
regionRoutes.route("/", updateRoute);
regionRoutes.route("/", deleteRoute);
regionRoutes.route("/", archiveRoute);
regionRoutes.route("/", restoreRoute);
