import { readFileSync, existsSync } from "node:fs";
import { PATHS } from "./constants.js";

export type SpMode = "minimal" | "adversarial";

export interface SpModeEnv {
  email?: string;
  password?: string;
  apiKey?: string;
  systemId?: string;
  manifestPath?: string;
  exportJsonPath?: string;
}

export interface SpTestEnv {
  spApiBaseUrl?: string;
  minimal: SpModeEnv;
  adversarial: SpModeEnv;
}

/** Returns an empty SpTestEnv (all sub-objects present but empty). */
export function emptyEnv(): SpTestEnv {
  return { minimal: {}, adversarial: {} };
}

const KEY_PATTERN =
  /^SP_(API_BASE_URL|TEST_(MINIMAL|ADVERSARIAL)_(EMAIL|PASSWORD|API_KEY|SYSTEM_ID|MANIFEST|EXPORT_JSON))$/;

interface ParsedLine {
  readonly key: string;
  readonly value: string;
}

function parseLines(content: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx < 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }
    out.push({ key, value });
  }
  return out;
}

function assignKey(env: SpTestEnv, key: string, value: string): void {
  if (!KEY_PATTERN.test(key)) return;
  if (key === "SP_API_BASE_URL") {
    env.spApiBaseUrl = value;
    return;
  }
  const match = /^SP_TEST_(MINIMAL|ADVERSARIAL)_(.+)$/.exec(key);
  if (!match) return;
  const mode = match[1] === "MINIMAL" ? "minimal" : "adversarial";
  const suffix = match[2];
  const target = env[mode];
  switch (suffix) {
    case "EMAIL":
      target.email = value;
      break;
    case "PASSWORD":
      target.password = value;
      break;
    case "API_KEY":
      target.apiKey = value;
      break;
    case "SYSTEM_ID":
      target.systemId = value;
      break;
    case "MANIFEST":
      target.manifestPath = value;
      break;
    case "EXPORT_JSON":
      target.exportJsonPath = value;
      break;
  }
}

export function readEnvFile(): SpTestEnv {
  const env = emptyEnv();
  if (!existsSync(PATHS.envFile)) return env;
  const content = readFileSync(PATHS.envFile, "utf-8");
  for (const { key, value } of parseLines(content)) {
    assignKey(env, key, value);
  }
  return env;
}
