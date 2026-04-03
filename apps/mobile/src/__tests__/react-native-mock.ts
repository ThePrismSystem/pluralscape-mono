/**
 * Minimal react-native stub for vitest (Node environment).
 * react-native uses Flow types and cannot be parsed by rolldown/esbuild.
 * This stub provides just enough surface area for tests that transitively
 * import react-native (e.g. via expo-constants).
 */
export const Platform = {
  OS: "ios",
  select: (obj: Record<string, unknown>): unknown => obj["ios"],
};
export const NativeModules = {};
export function NativeEventEmitter(): void {
  // stub
}
export const AppState = {
  addEventListener: (): { remove: () => undefined } => ({ remove: () => undefined }),
};
export default {};
