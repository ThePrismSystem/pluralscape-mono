import { Hono } from "hono";

import { authMiddleware } from "../../middleware/auth.js";

import { auditLogRoute } from "./audit-log.js";
import { changeEmailRoute } from "./change-email.js";
import { changePasswordRoute } from "./change-password.js";
import { deviceTransferRoute } from "./device-transfer.js";
import { getRoute } from "./get.js";
import { updateSettingsRoute } from "./update-settings.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const accountRoutes = new Hono<AuthEnv>();

// All account routes require authentication
accountRoutes.use("*", authMiddleware());

accountRoutes.route("/", getRoute);
accountRoutes.route("/email", changeEmailRoute);
accountRoutes.route("/password", changePasswordRoute);
accountRoutes.route("/audit-log", auditLogRoute);
accountRoutes.route("/device-transfer", deviceTransferRoute);
accountRoutes.route("/settings", updateSettingsRoute);
