import { Hono } from "hono";

import { authMiddleware } from "../../middleware/auth.js";
import { groupRoutes } from "../groups/index.js";

import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
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
