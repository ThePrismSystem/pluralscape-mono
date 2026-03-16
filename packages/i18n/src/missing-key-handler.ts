/** Creates a missing key handler for the given mode. */
export function createMissingKeyHandler(
  mode: "warn" | "throw",
): (key: string, namespace: string) => void {
  if (mode === "throw") {
    return (key: string, namespace: string) => {
      throw new Error(`Missing translation key: ${namespace}:${key}`);
    };
  }

  return (key: string, namespace: string) => {
    console.warn(`Missing translation key: ${namespace}:${key}`);
  };
}
