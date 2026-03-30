import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const frontingReportRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:reportId
frontingReportRoutes.route("/", listRoute);
frontingReportRoutes.route("/", getRoute);
frontingReportRoutes.route("/", createRoute);
frontingReportRoutes.route("/", updateRoute);
frontingReportRoutes.route("/", archiveRoute);
frontingReportRoutes.route("/", restoreRoute);
frontingReportRoutes.route("/", deleteRoute);
