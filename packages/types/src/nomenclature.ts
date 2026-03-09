/** Categories of terminology that can be customized. */
export type TermCategory = "identity" | "fronting" | "structure" | "communication" | "privacy";

/** A well-known canonical term and its default display value. */
export interface CanonicalTerm {
  readonly key: string;
  readonly category: TermCategory;
  readonly defaultValue: string;
}

/** A user's override for a specific term. */
export interface NomenclatureSettings {
  readonly preset: string;
  readonly overrides: Readonly<Record<string, string>>;
}

/** A named set of term overrides (e.g. "clinical", "community", "custom"). */
export interface TermPreset {
  readonly name: string;
  readonly label: string;
  readonly terms: Readonly<Record<string, string>>;
}

/** Built-in term presets. */
export const DEFAULT_TERM_PRESETS: readonly TermPreset[] = [
  {
    name: "community",
    label: "Community",
    terms: {
      member: "member",
      system: "system",
      fronting: "fronting",
      switch: "switch",
    },
  },
  {
    name: "clinical",
    label: "Clinical",
    terms: {
      member: "alter",
      system: "system",
      fronting: "presenting",
      switch: "transition",
    },
  },
] as const;

/** Creates default nomenclature settings using the community preset. */
export function createDefaultNomenclatureSettings(): NomenclatureSettings {
  return {
    preset: "community",
    overrides: {},
  };
}
