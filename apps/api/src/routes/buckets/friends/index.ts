import { Hono } from "hono";

import { assignRoute } from "./assign.js";
import { listRoute } from "./list.js";
import { unassignRoute } from "./unassign.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const friendAssignmentRoutes = new Hono<AuthEnv>();

friendAssignmentRoutes.route("/", listRoute);
friendAssignmentRoutes.route("/", assignRoute);
friendAssignmentRoutes.route("/", unassignRoute);
