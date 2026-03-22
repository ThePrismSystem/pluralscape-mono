import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const frontingCommentRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:commentId
frontingCommentRoutes.route("/", listRoute);
frontingCommentRoutes.route("/", getRoute);
frontingCommentRoutes.route("/", updateRoute);
frontingCommentRoutes.route("/", deleteRoute);
frontingCommentRoutes.route("/", createRoute);
frontingCommentRoutes.route("/", archiveRoute);
frontingCommentRoutes.route("/", restoreRoute);
