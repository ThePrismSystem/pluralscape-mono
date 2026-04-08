import { Hono } from "hono";

import { listRoute } from "./list.js";
import { lookupRoute } from "./lookup.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const importEntityRefRoutes = new Hono<AuthEnv>();

// lookupRoute (/lookup) before listRoute (/) so /lookup is not captured.
importEntityRefRoutes.route("/", lookupRoute);
importEntityRefRoutes.route("/", listRoute);
