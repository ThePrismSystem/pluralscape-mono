import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const noteRoutes = new Hono<AuthEnv>();

// Static paths first to avoid /:noteId capture
noteRoutes.route("/", listRoute);
noteRoutes.route("/", createRoute);
noteRoutes.route("/", getRoute);
noteRoutes.route("/", updateRoute);
noteRoutes.route("/", deleteRoute);
noteRoutes.route("/", archiveRoute);
noteRoutes.route("/", restoreRoute);
