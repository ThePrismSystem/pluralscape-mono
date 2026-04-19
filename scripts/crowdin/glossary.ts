import type { GlossariesModel } from "@crowdin/crowdin-api-client";

import type { CrowdinClient } from "./client.js";
import { getErrorMessage } from "./errors.js";
import type { GlossaryPos, GlossaryTerm } from "./glossary-schema.js";
import { LIST_PAGE_SIZE, MAX_PAGES } from "./pagination.constants.js";

export const GLOSSARY_NAME = "Pluralscape Terminology";

export const TERM_STATUS_PREFERRED = "preferred" as const;
export const TERM_STATUS_NOT_RECOMMENDED = "not recommended" as const;
export type TermStatus = typeof TERM_STATUS_PREFERRED | typeof TERM_STATUS_NOT_RECOMMENDED;

/**
 * Maps our glossary's part-of-speech strings (including community compounds
 * like "noun/verb") to Crowdin's PartOfSpeech enum. Compound forms are mapped
 * to their first listed component — Crowdin's glossary only accepts a single
 * POS tag per term. Keyed by the validated GlossaryPos enum, so adding a new
 * value to the schema surfaces as a type error here until mapped.
 */
const POS_MAPPING: Record<GlossaryPos, GlossariesModel.PartOfSpeech> = {
  adj: "adjective",
  noun: "noun",
  verb: "verb",
  "noun/verb": "noun",
  "verb/noun": "verb",
};

function mapPos(pos: GlossaryPos | undefined): GlossariesModel.PartOfSpeech | undefined {
  if (!pos) return undefined;
  const mapped = POS_MAPPING[pos];
  // Unreachable for schema-validated inputs; retained as defense-in-depth.
  if (!mapped) {
    throw new Error(
      `Unknown glossary pos value "${pos satisfies GlossaryPos}". Valid values: ${Object.keys(POS_MAPPING).join(", ")}.`,
    );
  }
  return mapped;
}

interface RemoteTerm {
  id: number;
  text: string;
  description?: string;
  status?: string;
  partOfSpeech?: GlossariesModel.PartOfSpeech;
}

export interface CrowdinTermPayload {
  text: string;
  description: string;
  isDoNotTranslate: boolean;
  partOfSpeech?: GlossariesModel.PartOfSpeech;
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
    partOfSpeech: mapPos(term.pos),
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

export interface GlossaryApplyResult extends GlossaryDiff {
  errors: Array<{
    operation: "add" | "update" | "remove";
    term?: string;
    id?: number;
    error: string;
  }>;
}

interface GlossaryListEntry {
  data: { id: number; name: string };
}

interface GlossaryTermEntry {
  data: {
    id: number;
    text: string;
    description?: string | null;
    status?: string | null;
    partOfSpeech?: GlossariesModel.PartOfSpeech | null;
  };
}

async function listAllGlossaries(
  list: (opts: { limit: number; offset: number }) => Promise<{ data: GlossaryListEntry[] }>,
): Promise<GlossaryListEntry[]> {
  const all: GlossaryListEntry[] = [];
  let pages = 0;
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    if (pages >= MAX_PAGES) {
      throw new Error(
        `listGlossaries: exceeded MAX_PAGES=${String(MAX_PAGES)} (offset=${String(offset)}).`,
      );
    }
    const page = await list({ limit: LIST_PAGE_SIZE, offset });
    all.push(...page.data);
    pages += 1;
    if (page.data.length < LIST_PAGE_SIZE) break;
  }
  return all;
}

async function listAllTerms(
  list: (
    glossaryId: number,
    opts: { limit: number; offset: number },
  ) => Promise<{ data: GlossaryTermEntry[] }>,
  glossaryId: number,
): Promise<GlossaryTermEntry[]> {
  const all: GlossaryTermEntry[] = [];
  let pages = 0;
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    if (pages >= MAX_PAGES) {
      throw new Error(
        `listTerms: exceeded MAX_PAGES=${String(MAX_PAGES)} for glossary ${String(glossaryId)} (offset=${String(offset)}).`,
      );
    }
    const page = await list(glossaryId, { limit: LIST_PAGE_SIZE, offset });
    all.push(...page.data);
    pages += 1;
    if (page.data.length < LIST_PAGE_SIZE) break;
  }
  return all;
}

function buildEditTermOps(
  payload: CrowdinTermPayload,
): Array<{ op: "replace"; path: string; value: string | GlossariesModel.PartOfSpeech }> {
  const ops: Array<{ op: "replace"; path: string; value: string | GlossariesModel.PartOfSpeech }> =
    [
      { op: "replace", path: "/description", value: payload.description },
      {
        op: "replace",
        path: "/status",
        value: payload.isDoNotTranslate ? TERM_STATUS_NOT_RECOMMENDED : TERM_STATUS_PREFERRED,
      },
    ];
  // Crowdin rejects a PATCH with value: undefined on /partOfSpeech. Only
  // include the op when we have a mapped value.
  if (payload.partOfSpeech !== undefined) {
    ops.push({ op: "replace", path: "/partOfSpeech", value: payload.partOfSpeech });
  }
  return ops;
}

async function tryOp(
  fn: () => Promise<unknown>,
  onError: (message: string) => void,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    onError(getErrorMessage(err));
  }
}

export async function applyGlossary(
  client: CrowdinClient,
  projectId: number,
  local: readonly GlossaryTerm[],
): Promise<GlossaryApplyResult> {
  const glossariesApi = client.glossariesApi;
  const glossaries = await listAllGlossaries((opts) => glossariesApi.listGlossaries(opts));
  let glossary = glossaries.find((g) => g.data.name === GLOSSARY_NAME)?.data;
  if (!glossary) {
    const created = await glossariesApi.addGlossary({ name: GLOSSARY_NAME, languageId: "en" });
    glossary = created.data;
  }
  const glossaryId = glossary.id;

  const remoteTerms = await listAllTerms(
    (id, opts) => glossariesApi.listTerms(id, opts),
    glossaryId,
  );
  const remote: RemoteTerm[] = remoteTerms.map((t) => ({
    id: t.data.id,
    text: t.data.text,
    description: t.data.description ?? undefined,
    status: t.data.status ?? undefined,
    partOfSpeech: t.data.partOfSpeech ?? undefined,
  }));

  const diff = diffGlossaryTerms(local, remote);
  const errors: GlossaryApplyResult["errors"] = [];

  for (const term of diff.toAdd) {
    await tryOp(
      async () => {
        const payload = termToCrowdinPayload(term);
        await glossariesApi.addTerm(glossaryId, {
          languageId: "en",
          text: payload.text,
          description: payload.description,
          status: payload.isDoNotTranslate ? TERM_STATUS_NOT_RECOMMENDED : TERM_STATUS_PREFERRED,
          partOfSpeech: payload.partOfSpeech,
        });
      },
      (error) => errors.push({ operation: "add", term: term.term, error }),
    );
  }

  for (const { id, term } of diff.toUpdate) {
    await tryOp(
      async () => {
        const payload = termToCrowdinPayload(term);
        await glossariesApi.editTerm(glossaryId, id, buildEditTermOps(payload));
      },
      (error) => errors.push({ operation: "update", term: term.term, id, error }),
    );
  }

  for (const id of diff.toRemove) {
    await tryOp(
      async () => {
        await glossariesApi.deleteTerm(glossaryId, id);
      },
      (error) => errors.push({ operation: "remove", id, error }),
    );
  }

  // Only flip the project-level glossary visibility after every term-level
  // op succeeded. Otherwise a partial failure leaves Crowdin surfacing an
  // incomplete glossary to translators with no signal that sync failed.
  if (errors.length > 0) {
    throw new AggregateError(
      errors.map((e) => new Error(`${e.operation} ${e.term ?? String(e.id)}: ${e.error}`)),
      `applyGlossary: ${errors.length} operation(s) failed`,
    );
  }

  await client.projectsGroupsApi.editProject(projectId, [
    { op: "replace", path: "/glossaryAccess", value: true },
  ]);

  return { ...diff, errors: [] };
}
