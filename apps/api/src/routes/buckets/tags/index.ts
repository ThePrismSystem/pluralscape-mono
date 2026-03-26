import { Hono } from "hono";

import { listTagsRoute } from "./list.js";
import { tagRoute } from "./tag.js";
import { untagRoute } from "./untag.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const tagRoutes = new Hono<AuthEnv>();

tagRoutes.route("/", listTagsRoute);
tagRoutes.route("/", tagRoute);
tagRoutes.route("/", untagRoute);
