import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadCrowdinEnv } from "../../crowdin/env.js";

const validJson = JSON.stringify({
  type: "service_account",
  project_id: "proj",
  private_key: "key",
  client_email: "a@b.com",
});

const baseEnv = {
  CROWDIN_PROJECT_ID: "100",
  CROWDIN_PERSONAL_TOKEN: "t",
  DEEPL_API_KEY: "d",
};

describe("loadCrowdinEnv", () => {
  it("accepts valid env", () => {
    const env = {
      CROWDIN_PROJECT_ID: "12345",
      CROWDIN_PERSONAL_TOKEN: "abc123",
      DEEPL_API_KEY: "deepl-key",
      GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: validJson,
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
      GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: validJson,
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
      GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: validJson,
    };
    expect(() => loadCrowdinEnv(env)).toThrow(/CROWDIN_PROJECT_ID/);
  });
});

describe("loadCrowdinEnv — Google credentials", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "crowdin-env-"));
  });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it("accepts GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON directly", () => {
    const env = loadCrowdinEnv({
      ...baseEnv,
      GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: validJson,
    });
    expect(env.googleCredentialsJson).toBe(validJson);
  });

  it("reads the file at GOOGLE_APPLICATION_CREDENTIALS when JSON var is absent", () => {
    const path = join(tmpDir, "creds.json");
    writeFileSync(path, validJson);
    const env = loadCrowdinEnv({
      ...baseEnv,
      GOOGLE_APPLICATION_CREDENTIALS: path,
    });
    expect(env.googleCredentialsJson).toBe(validJson);
  });

  it("prefers the JSON variable if both are set", () => {
    const path = join(tmpDir, "creds.json");
    const fileBlob = JSON.stringify({
      type: "service_account",
      project_id: "from-file",
      private_key: "k",
      client_email: "f@b.com",
    });
    writeFileSync(path, fileBlob);
    const env = loadCrowdinEnv({
      ...baseEnv,
      GOOGLE_APPLICATION_CREDENTIALS: path,
      GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: validJson,
    });
    expect(env.googleCredentialsJson).toBe(validJson);
  });

  it("rejects malformed service-account JSON (not valid JSON)", () => {
    expect(() =>
      loadCrowdinEnv({
        ...baseEnv,
        GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: "{not json",
      }),
    ).toThrow();
  });

  it("rejects a service-account JSON missing client_email", () => {
    const incomplete = JSON.stringify({
      type: "service_account",
      project_id: "p",
      private_key: "k",
    });
    expect(() =>
      loadCrowdinEnv({
        ...baseEnv,
        GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: incomplete,
      }),
    ).toThrow();
  });

  it("rejects env with neither Google var set", () => {
    expect(() => loadCrowdinEnv(baseEnv)).toThrow();
  });

  it("wraps readFileSync ENOENT with a descriptive error referencing the path", () => {
    const badPath = join(tmpDir, "nonexistent.json");
    expect(() => loadCrowdinEnv({ ...baseEnv, GOOGLE_APPLICATION_CREDENTIALS: badPath })).toThrow(
      /GOOGLE_APPLICATION_CREDENTIALS file at ".*nonexistent\.json"/,
    );
  });

  it("wraps a file with invalid JSON with a descriptive error referencing the source", () => {
    const path = join(tmpDir, "bad.json");
    writeFileSync(path, "{not json");
    expect(() => loadCrowdinEnv({ ...baseEnv, GOOGLE_APPLICATION_CREDENTIALS: path })).toThrow(
      /service-account JSON from GOOGLE_APPLICATION_CREDENTIALS file/,
    );
  });
});
