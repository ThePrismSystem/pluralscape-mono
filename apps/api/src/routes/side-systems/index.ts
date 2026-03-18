import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const sideSystemRoutes = new Hono<AuthEnv>();

// Static paths before parameterized to avoid capture
sideSystemRoutes.route("/", listRoute);
sideSystemRoutes.route("/", getRoute);
sideSystemRoutes.route("/", updateRoute);
sideSystemRoutes.route("/", deleteRoute);
sideSystemRoutes.route("/", createRoute);
sideSystemRoutes.route("/", archiveRoute);
sideSystemRoutes.route("/", restoreRoute);
