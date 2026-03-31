import { Hono } from "hono";

import { biometricRoute } from "./biometric.js";
import { loginRoute } from "./login.js";
import { passwordResetRoute } from "./password-reset.js";
import { recoveryKeyRoutes } from "./recovery-key.js";
import { registerRoute } from "./register.js";
import { sessionsRoute } from "./sessions.js";

export const authRoutes = new Hono();

// Prevent caching of all auth responses (tokens, keys, session data)
authRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});

authRoutes.route("/register", registerRoute);
authRoutes.route("/login", loginRoute);
authRoutes.route("/biometric", biometricRoute);
authRoutes.route("/password-reset", passwordResetRoute);
authRoutes.route("/recovery-key", recoveryKeyRoutes);
authRoutes.route("/", sessionsRoute);
