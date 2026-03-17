import { Hono } from "hono";

import { getSettingsRoute } from "./get-settings.js";
import { pinRoutes } from "./pin/index.js";
import { updateSettingsRoute } from "./update-settings.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const settingsRoutes = new Hono<AuthEnv>();

settingsRoutes.route("/", getSettingsRoute);
settingsRoutes.route("/", updateSettingsRoute);
settingsRoutes.route("/pin", pinRoutes);
