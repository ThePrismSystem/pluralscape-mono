import { Hono } from "hono";

import { coFrontingAnalyticsRoute } from "./co-fronting.js";
import { frontingAnalyticsRoute } from "./fronting.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const analyticsRoutes = new Hono<AuthEnv>();

analyticsRoutes.route("/fronting", frontingAnalyticsRoute);
analyticsRoutes.route("/co-fronting", coFrontingAnalyticsRoute);
