import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const fieldRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:fieldId
fieldRoutes.route("/", listRoute);
fieldRoutes.route("/", getRoute);
fieldRoutes.route("/", createRoute);
fieldRoutes.route("/", updateRoute);
fieldRoutes.route("/", archiveRoute);
fieldRoutes.route("/", restoreRoute);
