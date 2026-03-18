import { Hono } from "hono";

import { authMiddleware } from "../../middleware/auth.js";
import { bucketRoutes } from "../buckets/index.js";
import { customFrontRoutes } from "../custom-fronts/index.js";
import { fieldRoutes } from "../fields/index.js";
import { groupRoutes } from "../groups/index.js";
import { layerRoutes } from "../layers/index.js";
import { lifecycleEventRoutes } from "../lifecycle-events/index.js";
import { memberRoutes } from "../members/index.js";
import { relationshipRoutes } from "../relationships/index.js";
import { sideSystemRoutes } from "../side-systems/index.js";
import { structureLinkRoutes } from "../structure-links/index.js";
import { subsystemRoutes } from "../subsystems/index.js";

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
systemRoutes.route("/:id/groups", groupRoutes);
systemRoutes.route("/:id/custom-fronts", customFrontRoutes);
systemRoutes.route("/:id/settings", settingsRoutes);
systemRoutes.route("/:id/nomenclature", nomenclatureRoutes);
systemRoutes.route("/:id/setup", setupRoutes);
systemRoutes.route("/:id/buckets", bucketRoutes);
systemRoutes.route("/:systemId/members", memberRoutes);
systemRoutes.route("/:systemId/fields", fieldRoutes);
systemRoutes.route("/:id/subsystems", subsystemRoutes);
systemRoutes.route("/:id/side-systems", sideSystemRoutes);
systemRoutes.route("/:id/layers", layerRoutes);
systemRoutes.route("/:id/relationships", relationshipRoutes);
systemRoutes.route("/:id/lifecycle-events", lifecycleEventRoutes);
systemRoutes.route("/:id/structure-links", structureLinkRoutes);
