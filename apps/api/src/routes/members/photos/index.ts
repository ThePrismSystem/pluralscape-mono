import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { reorderRoute } from "./reorder.js";
import { restoreRoute } from "./restore.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const photoRoutes = new Hono<AuthEnv>();

// listRoute before routes with params so GET / is not captured
photoRoutes.route("/", listRoute);
photoRoutes.route("/", getRoute);
photoRoutes.route("/", createRoute);
photoRoutes.route("/", reorderRoute);
photoRoutes.route("/", archiveRoute);
photoRoutes.route("/", restoreRoute);
photoRoutes.route("/", deleteRoute);
