/** Categories of terminology that can be customized. */
export type TermCategory =
  | "collective"
  | "individual"
  | "fronting"
  | "switching"
  | "co-presence"
  | "internal-space"
  | "primary-fronter"
  | "structure"
  | "dormancy"
  | "body"
  | "amnesia"
  | "saturation";

/** A well-known canonical term and its default display value. */
export interface CanonicalTerm {
  readonly key: string;
  readonly category: TermCategory;
  readonly defaultValue: string;
}

/** Per-system nomenclature settings — one selected term per category. */
export type NomenclatureSettings = Readonly<Record<TermCategory, string>>;

/** A set of preset options for a single term category. */
export interface TermPreset {
  readonly category: TermCategory;
  readonly presets: readonly string[];
  readonly default: string;
}

/** Built-in term presets per category. */
export const DEFAULT_TERM_PRESETS: readonly TermPreset[] = [
  {
    category: "collective",
    presets: ["System", "Collective", "Household", "Crew", "Group"],
    default: "System",
  },
  {
    category: "individual",
    presets: ["Member", "Alter", "Headmate", "Part", "Insider", "Facet", "Aspect"],
    default: "Member",
  },
  {
    category: "fronting",
    presets: ["Fronting", "In front", "Driving", "Piloting"],
    default: "Fronting",
  },
  { category: "switching", presets: ["Switch", "Shift"], default: "Switch" },
  {
    category: "co-presence",
    presets: ["Co-fronting", "Co-conscious", "Co-driving"],
    default: "Co-fronting",
  },
  {
    category: "internal-space",
    presets: ["Headspace", "Innerworld"],
    default: "Headspace",
  },
  {
    category: "primary-fronter",
    presets: ["Host", "Primary fronter", "Main fronter"],
    default: "Host",
  },
  {
    category: "structure",
    presets: ["System Structure", "Topology", "Map"],
    default: "System Structure",
  },
  {
    category: "dormancy",
    presets: ["Dormancy", "Resting", "Inactive"],
    default: "Dormancy",
  },
  {
    category: "body",
    presets: ["Body", "Physical form", "Vessel"],
    default: "Body",
  },
  {
    category: "amnesia",
    presets: ["Amnesia", "Memory gap", "Blackout"],
    default: "Amnesia",
  },
  {
    category: "saturation",
    presets: ["Saturation", "Elaboration", "Completeness"],
    default: "Saturation",
  },
];

/** Creates default nomenclature settings using the default term for each category. */
export function createDefaultNomenclatureSettings(): NomenclatureSettings {
  const settings = {} as Record<TermCategory, string>;
  for (const preset of DEFAULT_TERM_PRESETS) {
    settings[preset.category] = preset.default;
  }
  return settings;
}
