import { Hono } from "hono";

import { listVisibilityRoute } from "./list.js";
import { removeVisibilityRoute } from "./remove.js";
import { setVisibilityRoute } from "./set.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const bucketVisibilityRoutes = new Hono<AuthEnv>();

bucketVisibilityRoutes.route("/", listVisibilityRoute);
bucketVisibilityRoutes.route("/", setVisibilityRoute);
bucketVisibilityRoutes.route("/", removeVisibilityRoute);
