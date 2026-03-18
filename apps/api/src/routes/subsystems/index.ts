import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const subsystemRoutes = new Hono<AuthEnv>();

// Static paths before parameterized to avoid capture
subsystemRoutes.route("/", listRoute);
subsystemRoutes.route("/", getRoute);
subsystemRoutes.route("/", updateRoute);
subsystemRoutes.route("/", deleteRoute);
subsystemRoutes.route("/", createRoute);
subsystemRoutes.route("/", archiveRoute);
subsystemRoutes.route("/", restoreRoute);
