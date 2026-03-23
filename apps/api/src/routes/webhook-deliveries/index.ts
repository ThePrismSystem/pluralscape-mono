import { Hono } from "hono";

import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const webhookDeliveryRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:deliveryId
webhookDeliveryRoutes.route("/", listRoute);
webhookDeliveryRoutes.route("/", getRoute);
webhookDeliveryRoutes.route("/", deleteRoute);
