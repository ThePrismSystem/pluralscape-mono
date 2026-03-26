import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { confirmRoute } from "./confirm.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const acknowledgementRoutes = new Hono<AuthEnv>();

// Static paths first to avoid /:acknowledgementId capture
acknowledgementRoutes.route("/", listRoute);
acknowledgementRoutes.route("/", createRoute);
acknowledgementRoutes.route("/", confirmRoute);
acknowledgementRoutes.route("/", archiveRoute);
acknowledgementRoutes.route("/", restoreRoute);
acknowledgementRoutes.route("/", getRoute);
acknowledgementRoutes.route("/", deleteRoute);
