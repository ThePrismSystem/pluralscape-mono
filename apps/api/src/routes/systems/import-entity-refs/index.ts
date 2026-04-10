import { Hono } from "hono";

import { listRoute } from "./list.js";
import { lookupBatchRoute } from "./lookup-batch.js";
import { lookupRoute } from "./lookup.js";
import { upsertBatchRoute } from "./upsert-batch.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const importEntityRefsRoute = new Hono<AuthEnv>()
  .route("/lookup-batch", lookupBatchRoute)
  .route("/upsert-batch", upsertBatchRoute)
  .route("/lookup", lookupRoute)
  .route("/", listRoute);
