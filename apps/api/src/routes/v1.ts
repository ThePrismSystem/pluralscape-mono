import { Hono } from "hono";

import { accountRoutes } from "./account/index.js";
import { authRoutes } from "./auth/index.js";
import { systemRoutes } from "./systems/index.js";

export const v1Routes = new Hono();

v1Routes.route("/account", accountRoutes);
v1Routes.route("/auth", authRoutes);
v1Routes.route("/systems", systemRoutes);
