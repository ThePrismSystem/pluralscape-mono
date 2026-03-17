import { Hono } from "hono";

import { removePinRoute } from "./remove-pin.js";
import { setPinRoute } from "./set-pin.js";
import { verifyPinRoute } from "./verify-pin.js";

import type { AuthEnv } from "../../../../lib/auth-context.js";

export const pinRoutes = new Hono<AuthEnv>();

pinRoutes.route("/", setPinRoute);
pinRoutes.route("/", removePinRoute);
pinRoutes.route("/verify", verifyPinRoute);
