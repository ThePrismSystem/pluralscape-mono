import type { Logger } from "@pluralscape/types";

/** Creates a missing key handler for the given mode. */
export function createMissingKeyHandler(mode: "throw"): (key: string, namespace: string) => void;
export function createMissingKeyHandler(
  mode: "warn",
  logger: Pick<Logger, "warn">,
): (key: string, namespace: string) => void;
export function createMissingKeyHandler(
  mode: "warn" | "throw",
  logger?: Pick<Logger, "warn">,
): (key: string, namespace: string) => void {
  if (mode === "throw") {
    return (key: string, namespace: string) => {
      throw new Error(`Missing translation key: ${namespace}:${key}`);
    };
  }
  if (!logger) {
    throw new Error("Logger is required when missingKeyMode is 'warn'");
  }
  return (key: string, namespace: string) => {
    logger.warn(`Missing translation key: ${namespace}:${key}`);
  };
}
