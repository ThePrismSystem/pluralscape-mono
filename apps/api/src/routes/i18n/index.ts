import { Hono, type Context } from "hono";

import { HTTP_SERVICE_UNAVAILABLE } from "../../http.constants.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { getI18nDeps } from "../../services/i18n-deps.js";

import { handleManifest } from "./manifest.js";
import { handleNamespace } from "./namespace.js";

/** Standard 503 envelope for when i18n deps aren't configured yet. */
function notConfiguredResponse(c: Context): Response {
  return c.json(
    {
      error: {
        code: "NOT_CONFIGURED",
        message: "Crowdin distribution not configured",
      },
    },
    HTTP_SERVICE_UNAVAILABLE,
  );
}

export const i18nRoutes = new Hono();

// Rate-limit every i18n fetch. The category config lives in packages/types.
i18nRoutes.use("*", createCategoryRateLimiter("i18nFetch"));

// Handlers are registered directly on this Hono instance (no nested sub-app
// .fetch()) so the outer path parameters are available via `c.req.param(...)`
// without a secondary route-match pass — the earlier nested-dispatch design
// 404'd in production because the inner app saw the full `/v1/i18n/...` path.
i18nRoutes.get("/manifest", (c) => {
  const deps = getI18nDeps();
  if (!deps) return notConfiguredResponse(c);
  return handleManifest(c, deps);
});

i18nRoutes.get("/:locale/:namespace", (c) => {
  const deps = getI18nDeps();
  if (!deps) return notConfiguredResponse(c);
  return handleNamespace(c, deps);
});
