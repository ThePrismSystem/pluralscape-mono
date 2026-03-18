import { Hono } from "hono";

import { canvasRoutes } from "./canvas/index.js";
import { entityRoutes } from "./entities/index.js";
import { regionRoutes } from "./regions/index.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const innerworldRoutes = new Hono<AuthEnv>();

innerworldRoutes.route("/regions", regionRoutes);
innerworldRoutes.route("/entities", entityRoutes);
innerworldRoutes.route("/canvas", canvasRoutes);
