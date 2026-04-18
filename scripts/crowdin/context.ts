import { readFileSync } from "node:fs";
import path from "node:path";

import type { CrowdinClient } from "./client.js";
import { CONTEXT_NAMESPACES, ContextFileSchema } from "./context-schema.js";

const LOCALES_ROOT = "apps/mobile/locales/en";

interface SourceString {
  id: number;
  identifier: string;
  context: string | null;
}

export interface ContextDiff {
  toUpdate: Array<{ id: number; newContext: string }>;
  unchanged: number;
}

export interface ContextApplyResult extends ContextDiff {
  errors: Array<{ id: number; error: string }>;
}

export function loadAllContexts(repoRoot: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const ns of CONTEXT_NAMESPACES) {
    const file = path.join(repoRoot, LOCALES_ROOT, `${ns}.context.json`);
    const parsed = ContextFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    for (const [key, ctx] of Object.entries(parsed)) {
      map.set(`${ns}.${key}`, ctx);
    }
  }
  return map;
}

export function diffContexts(
  strings: readonly SourceString[],
  desired: ReadonlyMap<string, string>,
): ContextDiff {
  const toUpdate: ContextDiff["toUpdate"] = [];
  let unchanged = 0;
  for (const s of strings) {
    const want = desired.get(s.identifier);
    if (!want) continue;
    if ((s.context ?? "") === want) {
      unchanged++;
      continue;
    }
    toUpdate.push({ id: s.id, newContext: want });
  }
  return { toUpdate, unchanged };
}

export async function applyContexts(
  client: CrowdinClient,
  projectId: number,
  desired: ReadonlyMap<string, string>,
): Promise<ContextApplyResult> {
  const response = await client.sourceStringsApi.listProjectStrings(projectId, { limit: 500 });
  const strings: SourceString[] = response.data.map((s) => ({
    id: s.data.id,
    identifier: s.data.identifier,
    context: s.data.context ?? null,
  }));
  const diff = diffContexts(strings, desired);
  const errors: ContextApplyResult["errors"] = [];

  for (const { id, newContext } of diff.toUpdate) {
    try {
      await client.sourceStringsApi.editString(projectId, id, [
        { op: "replace", path: "/context", value: newContext },
      ]);
    } catch (err) {
      errors.push({ id, error: String(err) });
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(
      errors.map((e) => new Error(`${e.id}: ${e.error}`)),
      `applyContexts: ${errors.length} update(s) failed`,
    );
  }
  return { ...diff, errors: [] };
}
