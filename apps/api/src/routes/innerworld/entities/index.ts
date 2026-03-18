import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const entityRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:entityId
entityRoutes.route("/", listRoute);
entityRoutes.route("/", getRoute);
entityRoutes.route("/", createRoute);
entityRoutes.route("/", updateRoute);
entityRoutes.route("/", deleteRoute);
entityRoutes.route("/", archiveRoute);
entityRoutes.route("/", restoreRoute);
