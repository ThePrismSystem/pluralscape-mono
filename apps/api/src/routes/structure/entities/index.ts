import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { hierarchyRoute } from "./hierarchy.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const entityRoutes = new Hono<AuthEnv>();

entityRoutes.route("/", listRoute);
entityRoutes.route("/", getRoute);
entityRoutes.route("/", createRoute);
entityRoutes.route("/", updateRoute);
entityRoutes.route("/", archiveRoute);
entityRoutes.route("/", restoreRoute);
entityRoutes.route("/", deleteRoute);
entityRoutes.route("/", hierarchyRoute);
