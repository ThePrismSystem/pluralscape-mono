import { Hono } from "hono";

import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const snapshotRoutes = new Hono<AuthEnv>();

snapshotRoutes.route("/", listRoute);
snapshotRoutes.route("/", getRoute);
snapshotRoutes.route("/", createRoute);
snapshotRoutes.route("/", deleteRoute);
