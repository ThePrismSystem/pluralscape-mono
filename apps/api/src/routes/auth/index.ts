import { Hono } from "hono";

import { loginRoute } from "./login.js";
import { registerRoute } from "./register.js";
import { sessionsRoute } from "./sessions.js";

export const authRoutes = new Hono();

authRoutes.route("/register", registerRoute);
authRoutes.route("/login", loginRoute);
authRoutes.route("/", sessionsRoute);
