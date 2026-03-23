import { Hono } from "hono";

import { authMiddleware } from "../../middleware/auth.js";
import { analyticsRoutes } from "../analytics/index.js";
import { blobRoutes } from "../blobs/index.js";
import { bucketRoutes } from "../buckets/index.js";
import { customFrontRoutes } from "../custom-fronts/index.js";
import { fieldRoutes } from "../fields/index.js";
import { frontingRoutes } from "../fronting/index.js";
import { frontingReportRoutes } from "../fronting-reports/index.js";
import { frontingSessionRoutes } from "../fronting-sessions/index.js";
import { groupRoutes } from "../groups/index.js";
import { innerworldRoutes } from "../innerworld/index.js";
import { lifecycleEventRoutes } from "../lifecycle-events/index.js";
import { memberRoutes } from "../members/index.js";
import { relationshipRoutes } from "../relationships/index.js";

import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { nomenclatureRoutes } from "./nomenclature/index.js";
import { settingsRoutes } from "./settings/index.js";
import { setupRoutes } from "./setup/index.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const systemRoutes = new Hono<AuthEnv>();

// All system routes require authentication
systemRoutes.use("*", authMiddleware());

// listRoute before getRoute so GET / is not captured by /:id
systemRoutes.route("/", listRoute);
systemRoutes.route("/", getRoute);
systemRoutes.route("/", updateRoute);
systemRoutes.route("/", deleteRoute);
systemRoutes.route("/", createRoute);

// Sub-resource routes
systemRoutes.route("/:systemId/groups", groupRoutes);
systemRoutes.route("/:systemId/custom-fronts", customFrontRoutes);
systemRoutes.route("/:systemId/settings", settingsRoutes);
systemRoutes.route("/:systemId/nomenclature", nomenclatureRoutes);
systemRoutes.route("/:systemId/setup", setupRoutes);
systemRoutes.route("/:systemId/buckets", bucketRoutes);
systemRoutes.route("/:systemId/members", memberRoutes);
systemRoutes.route("/:systemId/fields", fieldRoutes);
systemRoutes.route("/:systemId/relationships", relationshipRoutes);
systemRoutes.route("/:systemId/lifecycle-events", lifecycleEventRoutes);
systemRoutes.route("/:systemId/fronting", frontingRoutes);
systemRoutes.route("/:systemId/fronting-sessions", frontingSessionRoutes);
systemRoutes.route("/:systemId/innerworld", innerworldRoutes);
systemRoutes.route("/:systemId/blobs", blobRoutes);
systemRoutes.route("/:systemId/analytics", analyticsRoutes);
systemRoutes.route("/:systemId/fronting-reports", frontingReportRoutes);
