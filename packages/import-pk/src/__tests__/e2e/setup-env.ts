import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const MONOREPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");
const PK_ENV_PATH = path.join(MONOREPO_ROOT, ".env.pk-test");

if (existsSync(PK_ENV_PATH)) {
  for (const line of readFileSync(PK_ENV_PATH, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    process.env[key] ??= value;
  }
}
