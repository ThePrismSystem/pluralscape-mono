import { describe, expect, it } from "vitest";

import { loadCrowdinEnv } from "../../crowdin/env.js";

describe("loadCrowdinEnv", () => {
  it("accepts valid env", () => {
    const env = {
      CROWDIN_PROJECT_ID: "12345",
      CROWDIN_PERSONAL_TOKEN: "abc123",
      DEEPL_API_KEY: "deepl-key",
      GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}',
    };
    const result = loadCrowdinEnv(env);
    expect(result.projectId).toBe(12345);
    expect(result.token).toBe("abc123");
  });

  it("coerces numeric project ID", () => {
    const env = {
      CROWDIN_PROJECT_ID: "99",
      CROWDIN_PERSONAL_TOKEN: "t",
      DEEPL_API_KEY: "d",
      GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: "{}",
    };
    expect(loadCrowdinEnv(env).projectId).toBe(99);
  });

  it("rejects missing required keys", () => {
    expect(() => loadCrowdinEnv({})).toThrow(/CROWDIN_PROJECT_ID/);
  });

  it("rejects non-numeric project ID", () => {
    const env = {
      CROWDIN_PROJECT_ID: "not-a-number",
      CROWDIN_PERSONAL_TOKEN: "t",
      DEEPL_API_KEY: "d",
      GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: "{}",
    };
    expect(() => loadCrowdinEnv(env)).toThrow(/CROWDIN_PROJECT_ID/);
  });

  it("accepts optional Google creds path instead of JSON", () => {
    const env = {
      CROWDIN_PROJECT_ID: "1",
      CROWDIN_PERSONAL_TOKEN: "t",
      DEEPL_API_KEY: "d",
      GOOGLE_APPLICATION_CREDENTIALS: "/path/to/sa.json",
    };
    const result = loadCrowdinEnv(env);
    expect(result.googleCredentialsPath).toBe("/path/to/sa.json");
    expect(result.googleCredentialsJson).toBeUndefined();
  });
});
