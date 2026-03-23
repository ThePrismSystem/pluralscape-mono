import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const lifecycleEventRoutes = new Hono<AuthEnv>();

lifecycleEventRoutes.route("/", listRoute);
lifecycleEventRoutes.route("/", getRoute);
lifecycleEventRoutes.route("/", createRoute);
lifecycleEventRoutes.route("/", deleteRoute);
lifecycleEventRoutes.route("/", archiveRoute);
lifecycleEventRoutes.route("/", restoreRoute);
