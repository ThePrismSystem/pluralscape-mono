import { Hono } from "hono";

import { acceptRoute } from "./accept.js";
import { archiveRoute } from "./archive.js";
import { blockRoute } from "./block.js";
import { dashboardRoute } from "./dashboard.js";
import { exportRoutes } from "./export.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { friendNotificationRoutes } from "./notifications/index.js";
import { rejectRoute } from "./reject.js";
import { removeRoute } from "./remove.js";
import { restoreRoute } from "./restore.js";
import { visibilityRoute } from "./visibility.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const friendRoutes = new Hono<AuthEnv>();

friendRoutes.route("/", listRoute);
friendRoutes.route("/", getRoute);
friendRoutes.route("/", dashboardRoute);
friendRoutes.route("/", exportRoutes);
friendRoutes.route("/", acceptRoute);
friendRoutes.route("/", rejectRoute);
friendRoutes.route("/", blockRoute);
friendRoutes.route("/", removeRoute);
friendRoutes.route("/", visibilityRoute);
friendRoutes.route("/", archiveRoute);
friendRoutes.route("/", restoreRoute);
friendRoutes.route("/:connectionId/notifications", friendNotificationRoutes);
