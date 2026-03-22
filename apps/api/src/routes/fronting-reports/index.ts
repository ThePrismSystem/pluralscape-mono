import { Hono } from "hono";

import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const frontingReportRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:reportId
frontingReportRoutes.route("/", listRoute);
frontingReportRoutes.route("/", getRoute);
frontingReportRoutes.route("/", deleteRoute);
frontingReportRoutes.route("/", createRoute);
