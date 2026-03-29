import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { rotateSecretRoute } from "./rotate-secret.js";
import { testRoute } from "./test.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const webhookConfigRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:webhookId
webhookConfigRoutes.route("/", listRoute);
webhookConfigRoutes.route("/", getRoute);
webhookConfigRoutes.route("/", updateRoute);
webhookConfigRoutes.route("/", deleteRoute);
webhookConfigRoutes.route("/", createRoute);
webhookConfigRoutes.route("/", archiveRoute);
webhookConfigRoutes.route("/", restoreRoute);
webhookConfigRoutes.route("/", rotateSecretRoute);
webhookConfigRoutes.route("/", testRoute);
