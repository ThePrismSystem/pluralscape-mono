import type { CrowdinClient } from "./client.js";
import type { GlossaryTerm } from "./glossary-schema.js";

/** Crowdin glossary name used for this project. */
export const GLOSSARY_NAME = "Pluralscape Terminology";

interface RemoteTerm {
  id: number;
  text: string;
  description?: string;
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
    const expected = termToCrowdinPayload(term).description;
    if (match.description !== expected) {
      toUpdate.push({ id: match.id, term });
    }
  }
  const toRemove = remote.filter((r) => !localByTerm.has(r.text.toLowerCase())).map((r) => r.id);
  return { toAdd, toUpdate, toRemove };
}

export async function applyGlossary(
  client: CrowdinClient,
  projectId: number,
  local: readonly GlossaryTerm[],
): Promise<GlossaryDiff> {
  const glossariesApi = client.glossariesApi;
  const list = await glossariesApi.listGlossaries();
  let glossary = list.data.find((g) => g.data.name === GLOSSARY_NAME)?.data;
  if (!glossary) {
    const created = await glossariesApi.addGlossary({
      name: GLOSSARY_NAME,
      languageId: "en",
    });
    glossary = created.data;
  }
  const glossaryId = glossary.id;

  const remoteTerms = await glossariesApi.listTerms(glossaryId);
  const remote: RemoteTerm[] = remoteTerms.data.map((t) => ({
    id: t.data.id,
    text: t.data.text,
    description: t.data.description ?? undefined,
  }));

  const diff = diffGlossaryTerms(local, remote);

  for (const term of diff.toAdd) {
    const payload = termToCrowdinPayload(term);
    // Map isDoNotTranslate to SDK status field; Crowdin uses "not recommended"
    // to suppress a term from suggestions without hiding it from the glossary.
    await glossariesApi.addTerm(glossaryId, {
      languageId: "en",
      text: payload.text,
      description: payload.description,
      status: payload.isDoNotTranslate ? "not recommended" : "preferred",
    });
  }

  for (const { id, term } of diff.toUpdate) {
    const payload = termToCrowdinPayload(term);
    await glossariesApi.editTerm(glossaryId, id, [
      { op: "replace", path: "/description", value: payload.description },
      {
        op: "replace",
        path: "/status",
        value: payload.isDoNotTranslate ? "not recommended" : "preferred",
      },
    ]);
  }

  for (const id of diff.toRemove) {
    await glossariesApi.deleteTerm(glossaryId, id);
  }

  await client.projectsGroupsApi.editProject(projectId, [
    { op: "replace", path: "/glossaryAccess", value: true },
  ]);

  return diff;
}
