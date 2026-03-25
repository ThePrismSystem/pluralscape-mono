import { Hono } from "hono";

import { messageRoutes } from "../messages/index.js";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const channelRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:channelId
channelRoutes.route("/", listRoute);
channelRoutes.route("/", getRoute);
channelRoutes.route("/", updateRoute);
channelRoutes.route("/", deleteRoute);
channelRoutes.route("/", createRoute);
channelRoutes.route("/", archiveRoute);
channelRoutes.route("/", restoreRoute);

// Nested message routes under /:channelId/messages
channelRoutes.route("/:channelId/messages", messageRoutes);
