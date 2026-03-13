/** Deployment modes for Pluralscape instances. */
export type DeploymentMode = "hosted" | "self-hosted";

/**
 * Narrowed type for call sites that require self-hosted mode.
 * Use at API boundaries to prove the mode was checked before calling
 * guarded DB functions (e.g., search index operations).
 */
export type SelfHostedMode = Extract<DeploymentMode, "self-hosted">;

/**
 * Returns the current deployment mode from the DEPLOYMENT_MODE env var.
 * Defaults to "self-hosted" when unset (conservative — self-hosted operators control their keys).
 *
 * Only meaningful in the API/server context. Mobile/client packages do not use this.
 */
export function getDeploymentMode(): DeploymentMode {
  const mode = process.env["DEPLOYMENT_MODE"];
  if (mode === "hosted") {
    return "hosted";
  }
  return "self-hosted";
}
