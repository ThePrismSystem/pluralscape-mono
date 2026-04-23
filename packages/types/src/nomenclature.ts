import type { EncryptedBlob } from "./encryption-primitives.js";
import type { SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { Serialize } from "./type-assertions.js";

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

/**
 * Keys of `NomenclatureSettings` that are encrypted client-side before the
 * server sees them. Every term category is T1-encrypted — the union is
 * therefore identical to `TermCategory`. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextNomenclature parity)
 * - `NomenclatureServerMetadata` (derived via `Omit`)
 */
export type NomenclatureEncryptedFields = TermCategory;

/**
 * Server-visible Nomenclature metadata — raw Drizzle row shape for the
 * `nomenclature_settings` table.
 *
 * Nomenclature is a T1-encrypted entity stored in its own table keyed
 * on `systemId` (no separate `id` column — `systemId` is the primary
 * key). The decrypted shape `NomenclatureSettings` is a `Record` whose
 * keys match `NomenclatureEncryptedFields` (= every `TermCategory`),
 * so there is no unencrypted subset to preserve on the server — only
 * audit metadata and the opaque blob.
 */
export interface NomenclatureServerMetadata {
  readonly systemId: SystemId;
  readonly encryptedData: EncryptedBlob;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly version: number;
}

/**
 * JSON-wire representation of NomenclatureSettings. Each category's
 * selected term is a plain string on the wire (the blob's decrypted
 * content, not the Drizzle row).
 */
export type NomenclatureWire = Serialize<NomenclatureSettings>;

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
