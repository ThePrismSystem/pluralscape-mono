import { Hono } from "hono";

import { confirmRoute } from "./confirm.js";
import { deleteRoute } from "./delete.js";
import { downloadUrlRoute } from "./download-url.js";
import { getRoute } from "./get.js";
import { listRoute } from "./list.js";
import { uploadUrlRoute } from "./upload-url.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const blobRoutes = new Hono<AuthEnv>();

// listRoute before getRoute so GET / is not captured by /:blobId
blobRoutes.route("/", listRoute);
blobRoutes.route("/", uploadUrlRoute);
blobRoutes.route("/", getRoute);
blobRoutes.route("/", confirmRoute);
blobRoutes.route("/", downloadUrlRoute);
blobRoutes.route("/", deleteRoute);
