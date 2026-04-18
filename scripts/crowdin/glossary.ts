import type { GlossaryTerm } from "./glossary-schema.js";

export const GLOSSARY_NAME = "Pluralscape Terminology";

export const TERM_STATUS_PREFERRED = "preferred" as const;
export const TERM_STATUS_NOT_RECOMMENDED = "not recommended" as const;
export type TermStatus = typeof TERM_STATUS_PREFERRED | typeof TERM_STATUS_NOT_RECOMMENDED;

interface RemoteTerm {
  id: number;
  text: string;
  description?: string;
  status?: string;
  partOfSpeech?: string;
}

export interface CrowdinTermPayload {
  text: string;
  description: string;
  isDoNotTranslate: boolean;
  partOfSpeech?: string;
}

export function termToCrowdinPayload(term: GlossaryTerm): CrowdinTermPayload {
  const markers: string[] = [];
  if (term.type === "negative") markers.push("AVOID");
  if (term.hazard) markers.push(`[HAZARD: ${term.hazard}]`);
  if (term.loanword_ok) markers.push("[LOANWORD OK]");
  const description = [...markers, term.notes].filter(Boolean).join(" ");
  return {
    text: term.term,
    description,
    isDoNotTranslate: term.type !== "translatable",
    partOfSpeech: term.pos,
  };
}

export interface GlossaryDiff {
  toAdd: GlossaryTerm[];
  toUpdate: { id: number; term: GlossaryTerm }[];
  toRemove: number[];
}

export function diffGlossaryTerms(
  local: readonly GlossaryTerm[],
  remote: readonly RemoteTerm[],
): GlossaryDiff {
  const remoteByTerm = new Map(remote.map((r) => [r.text.toLowerCase(), r] as const));
  const localByTerm = new Set(local.map((t) => t.term.toLowerCase()));

  const toAdd: GlossaryTerm[] = [];
  const toUpdate: { id: number; term: GlossaryTerm }[] = [];
  for (const term of local) {
    const match = remoteByTerm.get(term.term.toLowerCase());
    if (!match) {
      toAdd.push(term);
      continue;
    }
    const expected = termToCrowdinPayload(term);
    const expectedStatus = expected.isDoNotTranslate
      ? TERM_STATUS_NOT_RECOMMENDED
      : TERM_STATUS_PREFERRED;
    if (
      match.description !== expected.description ||
      match.status !== expectedStatus ||
      match.partOfSpeech !== expected.partOfSpeech
    ) {
      toUpdate.push({ id: match.id, term });
    }
  }
  const toRemove = remote.filter((r) => !localByTerm.has(r.text.toLowerCase())).map((r) => r.id);
  return { toAdd, toUpdate, toRemove };
}

interface GlossaryPatchOp {
  op: "replace";
  path: string;
  value: unknown;
}

interface GlossarySummary {
  id: number;
  name: string;
}

interface RemoteTermResponseData {
  id: number;
  text: string;
  description?: string | null;
  status?: string | null;
  partOfSpeech?: string | null;
}

interface GlossaryListResponse {
  data: Array<{ data: GlossarySummary }>;
}

interface TermListResponse {
  data: Array<{ data: RemoteTermResponseData }>;
}

interface CreateTermRequest {
  languageId: string;
  text: string;
  description?: string;
  status?: TermStatus;
  partOfSpeech?: string;
}

/**
 * Minimal structural slice of `CrowdinClient` exercised by {@link applyGlossary}.
 * Tests can supply a stub without mocking the SDK's full surface; the real SDK
 * client satisfies this interface because its list/edit methods are assignable
 * to these parameter lists (the SDK's `PatchRequest` widens on `op`/`value`,
 * and method-parameter bivariance covers the rest).
 */
export interface GlossaryApiClient {
  glossariesApi: {
    listGlossaries(): Promise<GlossaryListResponse>;
    addGlossary(request: { name: string; languageId: string }): Promise<{
      data: GlossarySummary;
    }>;
    listTerms(glossaryId: number): Promise<TermListResponse>;
    addTerm(glossaryId: number, request: CreateTermRequest): Promise<unknown>;
    editTerm(glossaryId: number, termId: number, patch: GlossaryPatchOp[]): Promise<unknown>;
    deleteTerm(glossaryId: number, termId: number): Promise<void>;
  };
  projectsGroupsApi: {
    editProject(projectId: number, patch: GlossaryPatchOp[]): Promise<unknown>;
  };
}

export interface GlossaryApplyResult extends GlossaryDiff {
  errors: Array<{
    operation: "add" | "update" | "remove";
    term?: string;
    id?: number;
    error: string;
  }>;
}

export async function applyGlossary(
  client: GlossaryApiClient,
  projectId: number,
  local: readonly GlossaryTerm[],
): Promise<GlossaryApplyResult> {
  const glossariesApi = client.glossariesApi;
  const list = await glossariesApi.listGlossaries();
  let glossary = list.data.find((g) => g.data.name === GLOSSARY_NAME)?.data;
  if (!glossary) {
    const created = await glossariesApi.addGlossary({ name: GLOSSARY_NAME, languageId: "en" });
    glossary = created.data;
  }
  const glossaryId = glossary.id;

  const remoteTerms = await glossariesApi.listTerms(glossaryId);
  const remote: RemoteTerm[] = remoteTerms.data.map((t) => ({
    id: t.data.id,
    text: t.data.text,
    description: t.data.description ?? undefined,
    status: t.data.status ?? undefined,
    partOfSpeech: t.data.partOfSpeech ?? undefined,
  }));

  const diff = diffGlossaryTerms(local, remote);
  const errors: GlossaryApplyResult["errors"] = [];

  for (const term of diff.toAdd) {
    try {
      const payload = termToCrowdinPayload(term);
      await glossariesApi.addTerm(glossaryId, {
        languageId: "en",
        text: payload.text,
        description: payload.description,
        status: payload.isDoNotTranslate ? TERM_STATUS_NOT_RECOMMENDED : TERM_STATUS_PREFERRED,
        partOfSpeech: payload.partOfSpeech,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ operation: "add", term: term.term, error: message });
    }
  }

  for (const { id, term } of diff.toUpdate) {
    try {
      const payload = termToCrowdinPayload(term);
      await glossariesApi.editTerm(glossaryId, id, [
        { op: "replace", path: "/description", value: payload.description },
        {
          op: "replace",
          path: "/status",
          value: payload.isDoNotTranslate ? TERM_STATUS_NOT_RECOMMENDED : TERM_STATUS_PREFERRED,
        },
        { op: "replace", path: "/partOfSpeech", value: payload.partOfSpeech },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ operation: "update", term: term.term, id, error: message });
    }
  }

  for (const id of diff.toRemove) {
    try {
      await glossariesApi.deleteTerm(glossaryId, id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ operation: "remove", id, error: message });
    }
  }

  await client.projectsGroupsApi.editProject(projectId, [
    { op: "replace", path: "/glossaryAccess", value: true },
  ]);

  if (errors.length > 0) {
    throw new AggregateError(
      errors.map((e) => new Error(`${e.operation} ${e.term ?? String(e.id)}: ${e.error}`)),
      `applyGlossary: ${errors.length} operation(s) failed`,
    );
  }
  return { ...diff, errors: [] };
}
