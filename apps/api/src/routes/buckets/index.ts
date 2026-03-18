import { Hono } from "hono";

import { rotationRoutes } from "./rotations/index.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const bucketRoutes = new Hono<AuthEnv>();

bucketRoutes.route("/:bucketId/rotations", rotationRoutes);
