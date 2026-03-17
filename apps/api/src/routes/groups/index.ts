import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { memberRoutes } from "./members/index.js";
import { moveRoute } from "./move.js";
import { reorderRoute } from "./reorder.js";
import { restoreRoute } from "./restore.js";
import { treeRoute } from "./tree.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const groupRoutes = new Hono<AuthEnv>();

// Static paths before parameterized to avoid capture
groupRoutes.route("/", listRoute);
groupRoutes.route("/", treeRoute);
groupRoutes.route("/", reorderRoute);
groupRoutes.route("/", getRoute);
groupRoutes.route("/", updateRoute);
groupRoutes.route("/", deleteRoute);
groupRoutes.route("/", createRoute);
groupRoutes.route("/", moveRoute);
groupRoutes.route("/", archiveRoute);
groupRoutes.route("/", restoreRoute);

// Sub-resource routes
groupRoutes.route("/:groupId/members", memberRoutes);
