import { parseArgs } from "node:util";

import { createCrowdinClient } from "./crowdin/client.js";
import { applyContexts, loadAllContexts } from "./crowdin/context.js";
import { loadCrowdinEnv } from "./crowdin/env.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { "dry-run": { type: "boolean", default: false } },
  });
  const env = loadCrowdinEnv(process.env);
  const desired = loadAllContexts(process.cwd());

  if (values["dry-run"]) {
    const counts = [...desired.keys()].reduce<Record<string, number>>((acc, k) => {
      const ns = k.split(".")[0] ?? "unknown";
      acc[ns] = (acc[ns] ?? 0) + 1;
      return acc;
    }, {});
    console.log(JSON.stringify({ dryRun: true, namespaces: counts }, null, 2));
    return;
  }

  const client = createCrowdinClient(env);
  const result = await applyContexts(client, env.projectId, desired);
  console.log(
    JSON.stringify({ updated: result.toUpdate.length, unchanged: result.unchanged }, null, 2),
  );
}

main().catch((err: unknown) => {
  console.error("crowdin:upload-context failed:", err);
  process.exit(1);
});
