/** Deployment modes for Pluralscape instances. */
export type DeploymentMode = "hosted" | "self-hosted";

/**
 * Returns the current deployment mode from the DEPLOYMENT_MODE env var.
 * Defaults to "self-hosted" when unset (conservative — self-hosted operators control their keys).
 */
export function getDeploymentMode(): DeploymentMode {
  const mode = process.env["DEPLOYMENT_MODE"];
  if (mode === "hosted") {
    return "hosted";
  }
  return "self-hosted";
}
