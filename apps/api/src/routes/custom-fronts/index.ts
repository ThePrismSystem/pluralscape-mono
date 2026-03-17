import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const customFrontRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:customFrontId
customFrontRoutes.route("/", listRoute);
customFrontRoutes.route("/", getRoute);
customFrontRoutes.route("/", updateRoute);
customFrontRoutes.route("/", deleteRoute);
customFrontRoutes.route("/", createRoute);
customFrontRoutes.route("/", archiveRoute);
customFrontRoutes.route("/", restoreRoute);
