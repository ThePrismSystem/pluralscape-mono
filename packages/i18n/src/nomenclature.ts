import {
  type CanonicalTerm,
  DEFAULT_TERM_PRESETS,
  type NomenclatureSettings,
} from "@pluralscape/types";

/** Type-only contract for the M8 React hook. */
export interface UseNomenclatureResult {
  readonly resolveTerm: (canonical: CanonicalTerm) => string;
  readonly resolveTermPlural: (canonical: CanonicalTerm) => string;
  readonly resolveTermLower: (canonical: CanonicalTerm) => string;
  readonly resolveTermTitle: (canonical: CanonicalTerm) => string;
  readonly resolveTermUpper: (canonical: CanonicalTerm) => string;
}

/** Known keys for CANONICAL_TERMS — one per TermCategory in SCREAMING_SNAKE format. */
interface CanonicalTermMap {
  readonly COLLECTIVE: CanonicalTerm;
  readonly INDIVIDUAL: CanonicalTerm;
  readonly FRONTING: CanonicalTerm;
  readonly SWITCHING: CanonicalTerm;
  readonly CO_PRESENCE: CanonicalTerm;
  readonly INTERNAL_SPACE: CanonicalTerm;
  readonly PRIMARY_FRONTER: CanonicalTerm;
  readonly STRUCTURE: CanonicalTerm;
  readonly DORMANCY: CanonicalTerm;
  readonly BODY: CanonicalTerm;
  readonly AMNESIA: CanonicalTerm;
  readonly SATURATION: CanonicalTerm;
}

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
  // All 12 keys populated from DEFAULT_TERM_PRESETS; verified by tests
  return terms as CanonicalTermMap;
}

/** Canonical terms derived from DEFAULT_TERM_PRESETS, keyed by SCREAMING_SNAKE category name. */
export const CANONICAL_TERMS: CanonicalTermMap = buildCanonicalTerms();

/**
 * Explicit plural forms for all preset values.
 * Gerunds and adjective states are invariant (map to themselves).
 */
const PLURAL_RULES: Readonly<Record<string, string>> = (() => {
  const rules: Record<string, string> = {
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
  return rules;
})();

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function pluralizeHeuristic(term: string): string {
  if (term.length === 0) return term;
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
    if (value) return value;
  }
  return canonical.defaultValue;
}

/** Resolve and pluralize a canonical term. */
export function resolveTermPlural(
  canonical: CanonicalTerm,
  settings: NomenclatureSettings | null | undefined,
): string {
  const singular = resolveTerm(canonical, settings);
  const known = PLURAL_RULES[singular];
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
