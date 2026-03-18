import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const relationshipRoutes = new Hono<AuthEnv>();

// Static paths before parameterized to avoid capture
relationshipRoutes.route("/", listRoute);
relationshipRoutes.route("/", getRoute);
relationshipRoutes.route("/", updateRoute);
relationshipRoutes.route("/", deleteRoute);
relationshipRoutes.route("/", createRoute);
relationshipRoutes.route("/", archiveRoute);
relationshipRoutes.route("/", restoreRoute);
