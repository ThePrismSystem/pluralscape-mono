import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const timerConfigRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:timerId
timerConfigRoutes.route("/", listRoute);
timerConfigRoutes.route("/", getRoute);
timerConfigRoutes.route("/", updateRoute);
timerConfigRoutes.route("/", deleteRoute);
timerConfigRoutes.route("/", createRoute);
timerConfigRoutes.route("/", archiveRoute);
timerConfigRoutes.route("/", restoreRoute);
