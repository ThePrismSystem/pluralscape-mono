import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { endRoute } from "./end.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const frontingSessionRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:sessionId
frontingSessionRoutes.route("/", listRoute);
frontingSessionRoutes.route("/", getRoute);
frontingSessionRoutes.route("/", updateRoute);
frontingSessionRoutes.route("/", deleteRoute);
frontingSessionRoutes.route("/", createRoute);
frontingSessionRoutes.route("/", archiveRoute);
frontingSessionRoutes.route("/", restoreRoute);
frontingSessionRoutes.route("/", endRoute);
