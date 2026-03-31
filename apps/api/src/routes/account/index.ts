import { Hono } from "hono";

import { authMiddleware } from "../../middleware/auth.js";

import { auditLogRoute } from "./audit-log.js";
import { changeEmailRoute } from "./change-email.js";
import { changePasswordRoute } from "./change-password.js";
import { deleteRoute } from "./delete.js";
import { deviceTransferRoute } from "./device-transfer.js";
import { friendCodeRoutes } from "./friend-codes/index.js";
import { friendRoutes } from "./friends/index.js";
import { getRoute } from "./get.js";
import { accountPinRoutes } from "./pin/index.js";
import { updateSettingsRoute } from "./update-settings.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const accountRoutes = new Hono<AuthEnv>();

// All account routes require authentication
accountRoutes.use("*", authMiddleware());

// Prevent caching of all account responses (private data)
accountRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});

accountRoutes.route("/", getRoute);
accountRoutes.route("/", deleteRoute);
accountRoutes.route("/email", changeEmailRoute);
accountRoutes.route("/password", changePasswordRoute);
accountRoutes.route("/audit-log", auditLogRoute);
accountRoutes.route("/device-transfer", deviceTransferRoute);
accountRoutes.route("/settings", updateSettingsRoute);
accountRoutes.route("/pin", accountPinRoutes);
accountRoutes.route("/friends", friendRoutes);
accountRoutes.route("/friend-codes", friendCodeRoutes);
