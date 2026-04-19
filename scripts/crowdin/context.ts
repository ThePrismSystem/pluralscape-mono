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
  data: { id: number; fileId: number; identifier: string; context?: string | null };
}

interface SourceStringListResponse {
  data: SourceStringPageItem[];
}

interface FileListResponse {
  data: Array<{ data: { id: number; name: string } }>;
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
  sourceFilesApi: {
    listProjectFiles(
      projectId: number,
      options: { limit: number; offset: number },
    ): Promise<FileListResponse>;
  };
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
  fileId: number;
  identifier: string;
  context: string | null;
}

/**
 * Sidecar contexts keyed by namespace → bare-key → context description.
 * Crowdin stores each JSON-sourced string with its bare key as the identifier
 * (e.g., `common.json` → identifier `ok`), so we match using `(fileId, key)`
 * not `<namespace>.<key>` — early versions of this script used the dotted
 * form and matched zero strings once Crowdin JSON files were wired up.
 */
export type NamespacedContexts = ReadonlyMap<string, ReadonlyMap<string, string>>;

export interface ContextDiff {
  toUpdate: Array<{ id: number; newContext: string }>;
  unchanged: number;
}

export interface ContextApplyResult extends ContextDiff {
  errors: Array<{ id: number; error: string }>;
  /** Count of remote source strings inspected across all pages. */
  remoteIdentifiersChecked: number;
  /** Desired sidecar entries (reported as `<namespace>.<key>`) that did not match a remote string. */
  unmatchedDesiredKeys: string[];
  /** Namespaces that had sidecar entries but no corresponding Crowdin file. */
  unmatchedNamespaces: string[];
}

export function loadAllContexts(repoRoot: string): NamespacedContexts {
  const map = new Map<string, Map<string, string>>();
  for (const ns of CONTEXT_NAMESPACES) {
    const file = path.join(repoRoot, LOCALES_ROOT, `${ns}.context.json`);
    const parsed = ContextFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    const nsMap = new Map<string, string>();
    for (const [key, ctx] of Object.entries(parsed)) {
      nsMap.set(key, ctx);
    }
    map.set(ns, nsMap);
  }
  return map;
}

/**
 * Pure diff helper over a flat list of source strings. Each sidecar entry
 * becomes a `desired` lookup keyed by `(fileId, identifier)`; a mismatch on
 * either dimension skips the entry rather than cross-file-matching keys that
 * happen to share a name.
 */
export function diffContexts(
  strings: readonly SourceString[],
  desired: ReadonlyMap<number, ReadonlyMap<string, string>>,
): ContextDiff {
  const toUpdate: ContextDiff["toUpdate"] = [];
  let unchanged = 0;
  for (const s of strings) {
    const fileDesired = desired.get(s.fileId);
    if (!fileDesired) continue;
    const want = fileDesired.get(s.identifier);
    if (!want) continue;
    if ((s.context ?? "") === want) {
      unchanged++;
      continue;
    }
    toUpdate.push({ id: s.id, newContext: want });
  }
  return { toUpdate, unchanged };
}

async function listAllFiles(
  client: ContextApiClient,
  projectId: number,
): Promise<Map<string, number>> {
  const byName = new Map<string, number>();
  let pages = 0;
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    if (pages >= MAX_PAGES) {
      throw new Error(
        `applyContexts: exceeded MAX_PAGES=${String(MAX_PAGES)} while listing project files (offset=${String(offset)}).`,
      );
    }
    const response = await client.sourceFilesApi.listProjectFiles(projectId, {
      limit: LIST_PAGE_SIZE,
      offset,
    });
    for (const entry of response.data) {
      byName.set(entry.data.name, entry.data.id);
    }
    pages += 1;
    if (response.data.length < LIST_PAGE_SIZE) break;
  }
  return byName;
}

async function listAllStrings(
  client: ContextApiClient,
  projectId: number,
): Promise<SourceString[]> {
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
    for (const s of response.data) {
      strings.push({
        id: s.data.id,
        fileId: s.data.fileId,
        identifier: s.data.identifier,
        context: s.data.context ?? null,
      });
    }
    pages += 1;
    if (response.data.length < LIST_PAGE_SIZE) break;
  }
  return strings;
}

export async function applyContexts(
  client: ContextApiClient,
  projectId: number,
  desiredByNamespace: NamespacedContexts,
): Promise<ContextApplyResult> {
  const filesByName = await listAllFiles(client, projectId);
  const desiredByFileId = new Map<number, Map<string, string>>();
  const unmatchedNamespaces: string[] = [];
  for (const [ns, keys] of desiredByNamespace) {
    const fileId = filesByName.get(`${ns}.json`);
    if (fileId === undefined) {
      unmatchedNamespaces.push(ns);
      continue;
    }
    desiredByFileId.set(fileId, new Map(keys));
  }

  const strings = await listAllStrings(client, projectId);
  const diff = diffContexts(strings, desiredByFileId);

  // Compute unmatched keys in `<namespace>.<key>` form for diagnostics so the
  // error surface reads the same as prior versions of this script.
  const matchedPerFile = new Map<number, Set<string>>();
  for (const s of strings) {
    const fileDesired = desiredByFileId.get(s.fileId);
    if (!fileDesired?.has(s.identifier)) continue;
    let seen = matchedPerFile.get(s.fileId);
    if (!seen) {
      seen = new Set<string>();
      matchedPerFile.set(s.fileId, seen);
    }
    seen.add(s.identifier);
  }
  const unmatchedDesiredKeys: string[] = [];
  for (const [ns, keys] of desiredByNamespace) {
    const fileId = filesByName.get(`${ns}.json`);
    if (fileId === undefined) continue;
    const matched = matchedPerFile.get(fileId) ?? new Set<string>();
    for (const key of keys.keys()) {
      if (!matched.has(key)) unmatchedDesiredKeys.push(`${ns}.${key}`);
    }
  }

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
    unmatchedNamespaces,
  };
}
