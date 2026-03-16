import {
  type CanonicalTerm,
  DEFAULT_TERM_PRESETS,
  type NomenclatureSettings,
  type TermCategory,
} from "@pluralscape/types";

/** Type-only contract for the M8 React hook. */
export interface UseNomenclatureResult {
  readonly resolveTerm: (canonical: CanonicalTerm) => string;
  readonly resolveTermPlural: (canonical: CanonicalTerm) => string;
  readonly resolveTermLower: (canonical: CanonicalTerm) => string;
  readonly resolveTermTitle: (canonical: CanonicalTerm) => string;
  readonly resolveTermUpper: (canonical: CanonicalTerm) => string;
}

/** Convert a kebab-case string to SCREAMING_SNAKE at the type level. */
type ScreamingSnake<S extends string> = S extends `${infer A}-${infer B}`
  ? Uppercase<`${A}_${B}`>
  : Uppercase<S>;

/** Known keys for CANONICAL_TERMS — derived from TermCategory in SCREAMING_SNAKE format. */
type CanonicalTermMap = {
  readonly [K in TermCategory as ScreamingSnake<K>]: CanonicalTerm;
};

function buildCanonicalTerms(): CanonicalTermMap {
  const terms: Partial<Record<keyof CanonicalTermMap, CanonicalTerm>> = {};
  for (const preset of DEFAULT_TERM_PRESETS) {
    const key = preset.category.toUpperCase().replace(/-/g, "_") as keyof CanonicalTermMap;
    terms[key] = {
      key: preset.category,
      category: preset.category,
      defaultValue: preset.default,
    };
  }
  const expectedCount = 12;
  const populatedCount = Object.keys(terms).length;
  if (populatedCount !== expectedCount) {
    throw new Error(
      `Expected ${String(expectedCount)} canonical terms, got ${String(populatedCount)}`,
    );
  }
  return terms as CanonicalTermMap;
}

/** Canonical terms derived from DEFAULT_TERM_PRESETS, keyed by SCREAMING_SNAKE category name. */
export const CANONICAL_TERMS: CanonicalTermMap = buildCanonicalTerms();

/**
 * Explicit plural forms for all preset values.
 * Gerunds and adjective states are invariant (map to themselves).
 */
export const PRESET_PLURAL_RULES: Readonly<Record<string, string>> = {
  // collective
  System: "Systems",
  Collective: "Collectives",
  Household: "Households",
  Crew: "Crews",
  Group: "Groups",
  // individual
  Member: "Members",
  Alter: "Alters",
  Headmate: "Headmates",
  Part: "Parts",
  Insider: "Insiders",
  Facet: "Facets",
  Aspect: "Aspects",
  // fronting — gerunds/phrases are invariant
  Fronting: "Fronting",
  "In front": "In front",
  Driving: "Driving",
  Piloting: "Piloting",
  // switching
  Switch: "Switches",
  Shift: "Shifts",
  // co-presence — gerunds/adjectives invariant
  "Co-fronting": "Co-fronting",
  "Co-conscious": "Co-conscious",
  "Co-driving": "Co-driving",
  // internal-space
  Headspace: "Headspaces",
  Innerworld: "Innerworlds",
  // primary-fronter
  Host: "Hosts",
  "Primary fronter": "Primary fronters",
  "Main fronter": "Main fronters",
  // structure
  "System Structure": "System Structures",
  Topology: "Topologies",
  Map: "Maps",
  // dormancy
  Dormancy: "Dormancies",
  Resting: "Resting",
  Inactive: "Inactive",
  // body
  Body: "Bodies",
  "Physical form": "Physical forms",
  Vessel: "Vessels",
  // amnesia
  Amnesia: "Amnesias",
  "Memory gap": "Memory gaps",
  Blackout: "Blackouts",
  // saturation
  Saturation: "Saturations",
  Elaboration: "Elaborations",
  Completeness: "Completeness",
};

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function pluralizeHeuristic(term: string): string {
  if (term.length === 0) return term;

  // For multi-word terms, only pluralize the last word
  const spaceIdx = term.lastIndexOf(" ");
  if (spaceIdx !== -1) {
    return term.slice(0, spaceIdx + 1) + pluralizeHeuristic(term.slice(spaceIdx + 1));
  }

  const last = term.charAt(term.length - 1);
  const secondLast = term.length >= 2 ? term.charAt(term.length - 2) : "";

  // ends in consonant + y → replace y with ies
  if (last === "y" && secondLast !== "" && !VOWELS.has(secondLast)) {
    return term.slice(0, -1) + "ies";
  }

  // ends in ch, sh, x, s, z → append es
  if (last === "x" || last === "s" || last === "z") {
    return term + "es";
  }
  if ((secondLast === "c" || secondLast === "s") && last === "h") {
    return term + "es";
  }

  return term + "s";
}

/** Resolve a canonical term to its display string using the given settings. */
export function resolveTerm(
  canonical: CanonicalTerm,
  settings: NomenclatureSettings | null | undefined,
): string {
  if (settings) {
    const value = settings[canonical.category];
    if (value !== "") return value;
  }
  return canonical.defaultValue;
}

/** Resolve and pluralize a canonical term. */
export function resolveTermPlural(
  canonical: CanonicalTerm,
  settings: NomenclatureSettings | null | undefined,
): string {
  const singular = resolveTerm(canonical, settings);
  const known = PRESET_PLURAL_RULES[singular];
  if (known !== undefined) return known;
  return pluralizeHeuristic(singular);
}

/** Resolve a term and lowercase it. */
export function resolveTermLower(
  canonical: CanonicalTerm,
  settings: NomenclatureSettings | null | undefined,
): string {
  return resolveTerm(canonical, settings).toLowerCase();
}

/** Resolve a term and uppercase it. */
export function resolveTermUpper(
  canonical: CanonicalTerm,
  settings: NomenclatureSettings | null | undefined,
): string {
  return resolveTerm(canonical, settings).toUpperCase();
}

/** Resolve a term and title-case it (capitalize first letter of each space-separated word). */
export function resolveTermTitle(
  canonical: CanonicalTerm,
  settings: NomenclatureSettings | null | undefined,
): string {
  const term = resolveTerm(canonical, settings);
  return term
    .split(" ")
    .map((word) => {
      const first = word[0];
      return first !== undefined ? first.toUpperCase() + word.slice(1) : word;
    })
    .join(" ");
}
