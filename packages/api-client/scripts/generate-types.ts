import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(__dirname, "../../../docs/openapi.yaml");
const outputPath = resolve(__dirname, "../src/generated/api-types.ts");

console.log(`Generating types from ${specPath}...`);
execFileSync("npx", ["openapi-typescript", specPath, "-o", outputPath], { stdio: "inherit" });
console.log(`Types written to ${outputPath}`);
