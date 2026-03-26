import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { rotationRoutes } from "./rotations/index.js";
import { tagRoutes } from "./tags/index.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const bucketRoutes = new Hono<AuthEnv>();

// Static paths first to avoid /:bucketId capture
bucketRoutes.route("/", listRoute);
bucketRoutes.route("/", createRoute);
bucketRoutes.route("/", getRoute);
bucketRoutes.route("/", updateRoute);
bucketRoutes.route("/", deleteRoute);
bucketRoutes.route("/", archiveRoute);
bucketRoutes.route("/", restoreRoute);
bucketRoutes.route("/:bucketId/tags", tagRoutes);
bucketRoutes.route("/:bucketId/rotations", rotationRoutes);
