import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { createRoute } from "./create.js";
import { listRoute } from "./list.js";
import { redeemRoute } from "./redeem.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const friendCodeRoutes = new Hono<AuthEnv>();

// Mount /redeem before /:codeId paths to avoid parameter capture
friendCodeRoutes.route("/", redeemRoute);
friendCodeRoutes.route("/", listRoute);
friendCodeRoutes.route("/", createRoute);
friendCodeRoutes.route("/", archiveRoute);
