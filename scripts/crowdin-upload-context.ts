import { parseArgs } from "node:util";

import { createCrowdinClient } from "./crowdin/client.js";
import { applyContexts, loadAllContexts } from "./crowdin/context.js";
import { loadCrowdinEnv } from "./crowdin/env.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { "dry-run": { type: "boolean", default: false } },
  });
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

  const env = loadCrowdinEnv(process.env);
  const client = createCrowdinClient(env);
  const result = await applyContexts(client, env.projectId, desired);
  console.log(
    JSON.stringify(
      {
        updated: result.toUpdate.length,
        unchanged: result.unchanged,
        remoteStringsSeen: result.remoteIdentifiersChecked,
      },
      null,
      2,
    ),
  );
  if (desired.size > 0) {
    const unmatched = result.unmatchedDesiredKeys.length;
    const unmatchedFraction = unmatched / desired.size;
    if (unmatched === desired.size) {
      console.error(
        `error: ${String(desired.size)} sidecar entries were loaded but NONE matched a Crowdin source-string identifier. ` +
          `This usually means Crowdin uses a different identifier format than "<namespace>.<key>". ` +
          `Crowdin returned ${String(result.remoteIdentifiersChecked)} source strings. ` +
          `First 5 unmatched sidecar keys: ${result.unmatchedDesiredKeys.slice(0, 5).join(", ")}`,
      );
      process.exit(2);
    }
    if (unmatchedFraction > 0.5) {
      console.error(
        `error: ${String(unmatched)}/${String(desired.size)} sidecar entries (${String(Math.round(unmatchedFraction * 100))}%) did not match any Crowdin source string. ` +
          `First 5 unmatched: ${result.unmatchedDesiredKeys.slice(0, 5).join(", ")}`,
      );
      process.exit(2);
    }
  }
}

main().catch((err: unknown) => {
  console.error("crowdin:upload-context failed:", err);
  process.exit(1);
});
