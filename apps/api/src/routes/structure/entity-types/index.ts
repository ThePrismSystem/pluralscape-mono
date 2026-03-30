import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const entityTypeRoutes = new Hono<AuthEnv>();

entityTypeRoutes.route("/", listRoute);
entityTypeRoutes.route("/", getRoute);
entityTypeRoutes.route("/", createRoute);
entityTypeRoutes.route("/", updateRoute);
entityTypeRoutes.route("/", archiveRoute);
entityTypeRoutes.route("/", restoreRoute);
entityTypeRoutes.route("/", deleteRoute);
