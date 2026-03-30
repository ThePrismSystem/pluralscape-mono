import { Hono } from "hono";

import { removePinRoute } from "./remove-pin.js";
import { setPinRoute } from "./set-pin.js";
import { verifyPinRoute } from "./verify-pin.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const accountPinRoutes = new Hono<AuthEnv>();

accountPinRoutes.route("/", setPinRoute);
accountPinRoutes.route("/", removePinRoute);
accountPinRoutes.route("/verify", verifyPinRoute);
