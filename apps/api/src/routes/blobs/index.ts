import { Hono } from "hono";

import { confirmRoute } from "./confirm.js";
import { deleteRoute } from "./delete.js";
import { downloadUrlRoute } from "./download-url.js";
import { getRoute } from "./get.js";
import { uploadUrlRoute } from "./upload-url.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const blobRoutes = new Hono<AuthEnv>();

blobRoutes.route("/", uploadUrlRoute);
blobRoutes.route("/", getRoute);
blobRoutes.route("/", confirmRoute);
blobRoutes.route("/", downloadUrlRoute);
blobRoutes.route("/", deleteRoute);
