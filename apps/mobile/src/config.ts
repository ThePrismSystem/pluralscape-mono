import Constants from "expo-constants";

const DEV_API_BASE_URL = "http://localhost:3000";

export function getApiBaseUrl(): string {
  const extra: Record<string, unknown> | undefined = Constants.expoConfig?.extra;
  const configured: unknown = extra?.apiBaseUrl;
  if (typeof configured === "string" && configured.length > 0) {
    return configured;
  }
  return DEV_API_BASE_URL;
}
