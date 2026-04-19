import { readFileSync } from "node:fs";
import path from "node:path";

import { CONTEXT_NAMESPACES, ContextFileSchema } from "./context-schema.js";
import { getErrorMessage } from "./errors.js";
import { LIST_PAGE_SIZE, MAX_PAGES } from "./pagination.constants.js";

/**
 * Shape of a remote source-string page item consumed by {@link applyContexts}.
 * Matches the relevant subset of the Crowdin SDK `String` response.
 */
interface SourceStringPageItem {
  data: { id: number; identifier: string; context?: string | null };
}

interface SourceStringListResponse {
  data: SourceStringPageItem[];
}

/**
 * Patch operation shape accepted by the edit endpoint. Matches the Crowdin
 * SDK's `PatchRequest` subset actually emitted by {@link applyContexts}.
 */
interface ContextPatchOp {
  op: "replace";
  path: string;
  value: string;
}

/**
 * Minimal structural slice of `CrowdinClient` exercised by {@link applyContexts}.
 * The real SDK client satisfies this interface because its list/edit methods are
 * assignable to these parameter lists (the SDK's `PatchRequest` widens on
 * `op`/`value`, and method-parameter bivariance covers the rest). Tests can
 * supply a stub without mocking the SDK's full surface.
 */
export interface ContextApiClient {
  sourceStringsApi: {
    listProjectStrings(
      projectId: number,
      options: { limit: number; offset: number },
    ): Promise<SourceStringListResponse>;
    editString(projectId: number, stringId: number, patch: ContextPatchOp[]): Promise<unknown>;
  };
}

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
  /** Count of remote source strings inspected across all pages. */
  remoteIdentifiersChecked: number;
  /** Desired sidecar entries that did not match any remote identifier. */
  unmatchedDesiredKeys: string[];
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
  client: ContextApiClient,
  projectId: number,
  desired: ReadonlyMap<string, string>,
): Promise<ContextApplyResult> {
  const strings: SourceString[] = [];
  let pages = 0;
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    if (pages >= MAX_PAGES) {
      throw new Error(
        `applyContexts: exceeded MAX_PAGES=${String(MAX_PAGES)} while listing project strings (offset=${String(offset)}).`,
      );
    }
    const response = await client.sourceStringsApi.listProjectStrings(projectId, {
      limit: LIST_PAGE_SIZE,
      offset,
    });
    const page: SourceString[] = response.data.map((s) => ({
      id: s.data.id,
      identifier: s.data.identifier,
      context: s.data.context ?? null,
    }));
    strings.push(...page);
    pages += 1;
    if (page.length < LIST_PAGE_SIZE) break;
  }

  const diff = diffContexts(strings, desired);
  const remoteIdentifierSet = new Set(strings.map((s) => s.identifier));
  const unmatchedDesiredKeys = [...desired.keys()].filter((k) => !remoteIdentifierSet.has(k));
  const errors: ContextApplyResult["errors"] = [];

  for (const { id, newContext } of diff.toUpdate) {
    try {
      await client.sourceStringsApi.editString(projectId, id, [
        { op: "replace", path: "/context", value: newContext },
      ]);
    } catch (err) {
      errors.push({ id, error: getErrorMessage(err) });
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(
      errors.map((e) => new Error(`${e.id}: ${e.error}`)),
      `applyContexts: ${errors.length} update(s) failed`,
    );
  }
  return {
    ...diff,
    errors: [],
    remoteIdentifiersChecked: strings.length,
    unmatchedDesiredKeys,
  };
}
