import { Hono } from "hono";

import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { listRoute } from "./list.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const entityMemberLinkRoutes = new Hono<AuthEnv>();

entityMemberLinkRoutes.route("/", listRoute);
entityMemberLinkRoutes.route("/", createRoute);
entityMemberLinkRoutes.route("/", deleteRoute);
