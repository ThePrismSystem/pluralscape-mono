import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyEnv, readEnvFile, writeEnvFile } from "../env.js";

describe("readEnvFile", () => {
  let tmpDir: string;
  let envPath: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sp-seed-env-"));
    process.chdir(tmpDir);
    envPath = join(tmpDir, ".env.sp-test");
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns empty env when the file does not exist", () => {
    expect(readEnvFile()).toEqual(emptyEnv());
  });

  test("parses a full env file into structured form", () => {
    writeFileSync(
      envPath,
      [
        "SP_API_BASE_URL=https://sp.example.com",
        "SP_TEST_MINIMAL_EMAIL=min@example.com",
        "SP_TEST_MINIMAL_PASSWORD=pw1",
        "SP_TEST_MINIMAL_API_KEY=keyminimal",
        "SP_TEST_MINIMAL_SYSTEM_ID=uid-min",
        "SP_TEST_MINIMAL_MANIFEST=scripts/.sp-test-minimal-manifest.json",
        "SP_TEST_MINIMAL_EXPORT_JSON=scripts/.sp-test-minimal-export.json",
        "SP_TEST_ADVERSARIAL_EMAIL=adv@example.com",
        "SP_TEST_ADVERSARIAL_PASSWORD=pw2",
        "SP_TEST_ADVERSARIAL_API_KEY=keyadversarial",
        "SP_TEST_ADVERSARIAL_SYSTEM_ID=uid-adv",
        "SP_TEST_ADVERSARIAL_MANIFEST=scripts/.sp-test-adversarial-manifest.json",
        "SP_TEST_ADVERSARIAL_EXPORT_JSON=scripts/.sp-test-adversarial-export.json",
      ].join("\n") + "\n",
      "utf-8",
    );

    const env = readEnvFile();
    expect(env.spApiBaseUrl).toBe("https://sp.example.com");
    expect(env.minimal.email).toBe("min@example.com");
    expect(env.minimal.apiKey).toBe("keyminimal");
    expect(env.adversarial.systemId).toBe("uid-adv");
  });

  test("ignores blank lines and comments", () => {
    writeFileSync(
      envPath,
      ["# header comment", "", "SP_TEST_MINIMAL_EMAIL=foo@example.com", "# trailing comment"].join(
        "\n",
      ),
      "utf-8",
    );
    expect(readEnvFile().minimal.email).toBe("foo@example.com");
  });

  test("strips surrounding double quotes from values", () => {
    writeFileSync(envPath, 'SP_TEST_MINIMAL_EMAIL="quoted@example.com"\n', "utf-8");
    expect(readEnvFile().minimal.email).toBe("quoted@example.com");
  });

  test("unknown keys do not affect parsing", () => {
    writeFileSync(envPath, "SP_TEST_MINIMAL_EMAIL=x@example.com\nSOMETHING_ELSE=ignore\n", "utf-8");
    expect(readEnvFile().minimal.email).toBe("x@example.com");
  });
});

describe("writeEnvFile", () => {
  let tmpDir: string;
  let envPath: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sp-seed-env-write-"));
    process.chdir(tmpDir);
    // Create a .gitignore that ignores the target file so the safety check passes.
    writeFileSync(join(tmpDir, ".gitignore"), ".env.sp-test\n", "utf-8");
    // Initialize a git repo so git check-ignore works.
    require("node:child_process").execSync("git init -q", { cwd: tmpDir });
    envPath = join(tmpDir, ".env.sp-test");
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("round-trips a full env through write → read", () => {
    const env = {
      spApiBaseUrl: "https://sp.example.com",
      minimal: {
        email: "min@example.com",
        password: "pw1",
        apiKey: "keymin",
        systemId: "uidmin",
        manifestPath: "scripts/.sp-test-minimal-manifest.json",
        exportJsonPath: "scripts/.sp-test-minimal-export.json",
      },
      adversarial: {
        email: "adv@example.com",
        password: "pw2",
        apiKey: "keyadv",
        systemId: "uidadv",
        manifestPath: "scripts/.sp-test-adversarial-manifest.json",
        exportJsonPath: "scripts/.sp-test-adversarial-export.json",
      },
    };
    writeEnvFile(env);
    expect(readEnvFile()).toEqual(env);
  });

  test("refuses to write when .env.sp-test is not gitignored", () => {
    writeFileSync(join(tmpDir, ".gitignore"), "# nothing ignored\n", "utf-8");
    expect(() => writeEnvFile(emptyEnv())).toThrow(/refusing to write.*not gitignored/);
  });

  test("omits undefined fields from the written output", () => {
    writeEnvFile({
      minimal: { email: "only@example.com" },
      adversarial: {},
    });
    const content = readFileSync(envPath, "utf-8");
    expect(content).toMatch(/SP_TEST_MINIMAL_EMAIL=only@example\.com/);
    expect(content).not.toMatch(/SP_TEST_MINIMAL_PASSWORD/);
    expect(content).not.toMatch(/SP_TEST_ADVERSARIAL_EMAIL/);
  });
});
