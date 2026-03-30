import { Hono } from "hono";

import { entityRoutes } from "./entities/index.js";
import { entityAssociationRoutes } from "./entity-associations/index.js";
import { entityLinkRoutes } from "./entity-links/index.js";
import { entityMemberLinkRoutes } from "./entity-member-links/index.js";
import { entityTypeRoutes } from "./entity-types/index.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const structureRoutes = new Hono<AuthEnv>();

structureRoutes.route("/entity-types", entityTypeRoutes);
structureRoutes.route("/entities", entityRoutes);
structureRoutes.route("/entity-links", entityLinkRoutes);
structureRoutes.route("/entity-associations", entityAssociationRoutes);
structureRoutes.route("/entity-member-links", entityMemberLinkRoutes);
