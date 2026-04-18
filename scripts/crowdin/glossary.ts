import type { GlossariesModel } from "@crowdin/crowdin-api-client";

import type { CrowdinClient } from "./client.js";
import type { GlossaryTerm } from "./glossary-schema.js";

export const GLOSSARY_NAME = "Pluralscape Terminology";

export const TERM_STATUS_PREFERRED = "preferred" as const;
export const TERM_STATUS_NOT_RECOMMENDED = "not recommended" as const;
export type TermStatus = typeof TERM_STATUS_PREFERRED | typeof TERM_STATUS_NOT_RECOMMENDED;

/**
 * Maps our glossary's freeform part-of-speech strings (including community
 * compounds like "noun/verb") to Crowdin's PartOfSpeech enum. Compound
 * forms are mapped to their first listed component — Crowdin's glossary
 * only accepts a single POS tag per term.
 */
const POS_MAPPING: Record<string, GlossariesModel.PartOfSpeech> = {
  adj: "adjective",
  noun: "noun",
  verb: "verb",
  "noun/verb": "noun",
  "verb/noun": "verb",
};

function mapPos(pos: string | undefined): GlossariesModel.PartOfSpeech | undefined {
  if (!pos) return undefined;
  const mapped = POS_MAPPING[pos];
  if (!mapped) {
    throw new Error(
      `Unknown glossary pos value "${pos}". Valid values: ${Object.keys(POS_MAPPING).join(", ")}.`,
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

export async function applyGlossary(
  client: CrowdinClient,
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
