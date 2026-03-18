import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { layerMembershipRoutes } from "./memberships/index.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const layerRoutes = new Hono<AuthEnv>();

// Static paths before parameterized to avoid capture
layerRoutes.route("/", listRoute);
layerRoutes.route("/", getRoute);
layerRoutes.route("/", updateRoute);
layerRoutes.route("/", deleteRoute);
layerRoutes.route("/", createRoute);
layerRoutes.route("/", archiveRoute);
layerRoutes.route("/", restoreRoute);

// Sub-resource routes
layerRoutes.route("/:layerId/memberships", layerMembershipRoutes);
