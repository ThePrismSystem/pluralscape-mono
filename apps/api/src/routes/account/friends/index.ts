import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { blockRoute } from "./block.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { removeRoute } from "./remove.js";
import { restoreRoute } from "./restore.js";
import { visibilityRoute } from "./visibility.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const friendRoutes = new Hono<AuthEnv>();

friendRoutes.route("/", listRoute);
friendRoutes.route("/", getRoute);
friendRoutes.route("/", blockRoute);
friendRoutes.route("/", removeRoute);
friendRoutes.route("/", visibilityRoute);
friendRoutes.route("/", archiveRoute);
friendRoutes.route("/", restoreRoute);
