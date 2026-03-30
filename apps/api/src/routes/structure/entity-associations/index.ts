import { Hono } from "hono";

import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { listRoute } from "./list.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const entityAssociationRoutes = new Hono<AuthEnv>();

entityAssociationRoutes.route("/", listRoute);
entityAssociationRoutes.route("/", createRoute);
entityAssociationRoutes.route("/", deleteRoute);
