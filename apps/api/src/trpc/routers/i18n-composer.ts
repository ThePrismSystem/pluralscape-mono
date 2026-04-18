import { getI18nDeps } from "../../services/i18n-deps.js";

import { createI18nRouter } from "./i18n.js";

export const i18nRouter = createI18nRouter(getI18nDeps);
