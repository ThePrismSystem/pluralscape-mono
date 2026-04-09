import { Hono } from "hono";

import { listRoute } from "./list.js";
import { lookupRoute } from "./lookup.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const importEntityRefsRoute = new Hono<AuthEnv>()
  .route("/lookup", lookupRoute)
  .route("/", listRoute);
