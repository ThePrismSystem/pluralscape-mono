// scripts/sp-seed/index.ts
import process from "node:process";
import {
  SP_API_BASE_URL_DEFAULT,
  SP_TEST_PASSWORD_ENV_KEY,
  SP_TEST_PASSWORD_FALLBACK,
} from "./constants.js";
import { readEnvFile, type SpMode, type SpTestEnv } from "./env.js";
import { MINIMAL_FIXTURES } from "./fixtures/minimal.js";
import { ADVERSARIAL_FIXTURES } from "./fixtures/adversarial.js";
import { seedMode, type ModeCreds } from "./seed.js";

function resolveCreds(mode: SpMode, cliEmail: string | undefined, env: SpTestEnv): ModeCreds {
  const email = cliEmail ?? env[mode].email;
  if (!email) {
    throw new Error(
      `no email provided for ${mode} mode — ` +
        `pass as CLI arg or set SP_TEST_${mode.toUpperCase()}_EMAIL in .env.sp-test`,
    );
  }
  const password =
    env[mode].password ?? process.env[SP_TEST_PASSWORD_ENV_KEY] ?? SP_TEST_PASSWORD_FALLBACK;
  return { email, password };
}

async function main(): Promise<void> {
  const [minimalEmailArg, adversarialEmailArg] = process.argv.slice(2);
  const env = readEnvFile();
  const baseUrl = env.spApiBaseUrl ?? SP_API_BASE_URL_DEFAULT;

  console.log("SP Test Data Seeding Script");
  console.log("===========================");
  console.log(`SP API base: ${baseUrl}`);

  const minimalCreds = resolveCreds("minimal", minimalEmailArg, env);
  const adversarialCreds = resolveCreds("adversarial", adversarialEmailArg, env);

  await seedMode("minimal", minimalCreds, MINIMAL_FIXTURES, env, baseUrl);
  await seedMode("adversarial", adversarialCreds, ADVERSARIAL_FIXTURES, env, baseUrl);

  console.log("\n=== All done ===");
  console.log("Credentials:      .env.sp-test");
  console.log("Manifests:        scripts/.sp-test-{minimal,adversarial}-manifest.json");
  console.log(
    "Export JSON (operator downloads from email): scripts/.sp-test-{minimal,adversarial}-export.json",
  );
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
