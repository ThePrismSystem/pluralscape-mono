import { Hono } from "hono";

import { setupCompleteRoute } from "./complete.js";
import { nomenclatureStepRoute } from "./nomenclature-step.js";
import { profileStepRoute } from "./profile-step.js";
import { setupStatusRoute } from "./status.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const setupRoutes = new Hono<AuthEnv>();

setupRoutes.route("/status", setupStatusRoute);
setupRoutes.route("/nomenclature", nomenclatureStepRoute);
setupRoutes.route("/profile", profileStepRoute);
setupRoutes.route("/complete", setupCompleteRoute);
