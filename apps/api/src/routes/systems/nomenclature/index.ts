import { Hono } from "hono";

import { getNomenclatureRoute } from "./get-nomenclature.js";
import { updateNomenclatureRoute } from "./update-nomenclature.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const nomenclatureRoutes = new Hono<AuthEnv>();

nomenclatureRoutes.route("/", getNomenclatureRoute);
nomenclatureRoutes.route("/", updateNomenclatureRoute);
