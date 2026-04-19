import { parseArgs } from "node:util";

import { createCrowdinClient } from "./crowdin/client.js";
import { applyContexts, loadAllContexts } from "./crowdin/context.js";
import { loadCrowdinEnv } from "./crowdin/env.js";

function totalEntries(contexts: ReadonlyMap<string, ReadonlyMap<string, string>>): number {
  let n = 0;
  for (const inner of contexts.values()) n += inner.size;
  return n;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { "dry-run": { type: "boolean", default: false } },
  });
  const desired = loadAllContexts(process.cwd());

  if (values["dry-run"]) {
    const counts: Record<string, number> = {};
    for (const [ns, entries] of desired) counts[ns] = entries.size;
    console.log(JSON.stringify({ dryRun: true, namespaces: counts }, null, 2));
    return;
  }

  const env = loadCrowdinEnv(process.env);
  const client = createCrowdinClient(env);
  const result = await applyContexts(client, env.projectId, desired);
  const totalDesired = totalEntries(desired);
  console.log(
    JSON.stringify(
      {
        updated: result.toUpdate.length,
        unchanged: result.unchanged,
        remoteStringsSeen: result.remoteIdentifiersChecked,
        unmatchedNamespaces: result.unmatchedNamespaces,
      },
      null,
      2,
    ),
  );

  if (result.unmatchedNamespaces.length > 0) {
    console.error(
      `error: sidecar namespaces without a matching Crowdin source file: ${result.unmatchedNamespaces.join(", ")}. ` +
        `Expected Crowdin file names to match "<namespace>.json". Run crowdin:push sources first.`,
    );
    process.exit(2);
  }

  if (totalDesired > 0) {
    const unmatched = result.unmatchedDesiredKeys.length;
    const unmatchedFraction = unmatched / totalDesired;
    if (unmatched === totalDesired) {
      console.error(
        `error: ${String(totalDesired)} sidecar entries were loaded but NONE matched a Crowdin source-string identifier. ` +
          `Crowdin returned ${String(result.remoteIdentifiersChecked)} source strings. ` +
          `First 5 unmatched sidecar keys: ${result.unmatchedDesiredKeys.slice(0, 5).join(", ")}`,
      );
      process.exit(2);
    }
    if (unmatchedFraction > 0.5) {
      console.error(
        `error: ${String(unmatched)}/${String(totalDesired)} sidecar entries (${String(Math.round(unmatchedFraction * 100))}%) did not match any Crowdin source string. ` +
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
