import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { duplicateRoute } from "./duplicate.js";
import { fieldValueRoutes } from "./fields/index.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { membershipsRoute } from "./memberships.js";
import { photoRoutes } from "./photos/index.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const memberRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:memberId
memberRoutes.route("/", listRoute);
memberRoutes.route("/", getRoute);
memberRoutes.route("/", createRoute);
memberRoutes.route("/", updateRoute);
memberRoutes.route("/", duplicateRoute);
memberRoutes.route("/", archiveRoute);
memberRoutes.route("/", restoreRoute);
memberRoutes.route("/", deleteRoute);

// Nested sub-routes
memberRoutes.route("/:memberId/fields", fieldValueRoutes);
memberRoutes.route("/:memberId/photos", photoRoutes);
memberRoutes.route("/:memberId/memberships", membershipsRoute);
