import { readFileSync, existsSync, writeFileSync, renameSync } from "node:fs";
import { execSync } from "node:child_process";
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

function isGitignored(path: string): boolean {
  try {
    execSync(`git check-ignore -q ${JSON.stringify(path)}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function serialize(env: SpTestEnv): string {
  const lines: string[] = [];
  if (env.spApiBaseUrl !== undefined) {
    lines.push(`SP_API_BASE_URL=${env.spApiBaseUrl}`);
    lines.push("");
  }
  for (const mode of ["minimal", "adversarial"] as const) {
    const m = env[mode];
    const prefix = `SP_TEST_${mode.toUpperCase()}`;
    const modeLines: string[] = [];
    if (m.email !== undefined) modeLines.push(`${prefix}_EMAIL=${m.email}`);
    if (m.password !== undefined) modeLines.push(`${prefix}_PASSWORD=${m.password}`);
    if (m.apiKey !== undefined) modeLines.push(`${prefix}_API_KEY=${m.apiKey}`);
    if (m.systemId !== undefined) modeLines.push(`${prefix}_SYSTEM_ID=${m.systemId}`);
    if (m.manifestPath !== undefined) modeLines.push(`${prefix}_MANIFEST=${m.manifestPath}`);
    if (m.exportJsonPath !== undefined) modeLines.push(`${prefix}_EXPORT_JSON=${m.exportJsonPath}`);
    if (modeLines.length > 0) {
      lines.push(`# --- ${mode} mode ---`);
      lines.push(...modeLines);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function writeEnvFile(env: SpTestEnv): void {
  if (!isGitignored(PATHS.envFile)) {
    throw new Error(
      `refusing to write ${PATHS.envFile} — file is not gitignored. ` +
        `Add ".env.sp-test" to .gitignore before re-running.`,
    );
  }
  const content = serialize(env);
  const tmpPath = `${PATHS.envFile}.tmp`;
  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, PATHS.envFile);
}
