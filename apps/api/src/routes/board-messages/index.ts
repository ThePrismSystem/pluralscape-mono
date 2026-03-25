import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { pinRoute } from "./pin.js";
import { reorderRoute } from "./reorder.js";
import { restoreRoute } from "./restore.js";
import { unpinRoute } from "./unpin.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const boardMessageRoutes = new Hono<AuthEnv>();

// Static paths first to avoid /:boardMessageId capture
boardMessageRoutes.route("/", listRoute);
boardMessageRoutes.route("/", reorderRoute);
boardMessageRoutes.route("/", getRoute);
boardMessageRoutes.route("/", updateRoute);
boardMessageRoutes.route("/", deleteRoute);
boardMessageRoutes.route("/", createRoute);
boardMessageRoutes.route("/", archiveRoute);
boardMessageRoutes.route("/", restoreRoute);
boardMessageRoutes.route("/", pinRoute);
boardMessageRoutes.route("/", unpinRoute);
