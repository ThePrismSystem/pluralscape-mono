import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { dismissRoute } from "./dismiss.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { respondRoute } from "./respond.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const checkInRecordRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:recordId
checkInRecordRoutes.route("/", listRoute);
checkInRecordRoutes.route("/", getRoute);
checkInRecordRoutes.route("/", createRoute);
checkInRecordRoutes.route("/", archiveRoute);
checkInRecordRoutes.route("/", deleteRoute);
checkInRecordRoutes.route("/", respondRoute);
checkInRecordRoutes.route("/", dismissRoute);
