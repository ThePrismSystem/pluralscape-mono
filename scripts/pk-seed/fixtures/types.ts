/** A fixture-local symbolic id used to reference entities before server-side IDs exist. */
export type FixtureRef = string;

/** A field value that is either a literal of type T, or a FixtureRef placeholder. */
export type RefOr<T> = T | FixtureRef;

/** A single fixture entry: a symbolic ref plus the POST body. */
export interface FixtureDef<TBody> {
  readonly ref: FixtureRef;
  readonly body: TBody;
}

// --- Entity body types (match PK API v2 POST schemas) ---

export interface MemberBody {
  readonly name: string;
  readonly pronouns?: string | null;
  readonly description?: string | null;
  readonly color?: string | null;
  readonly avatar_url?: string | null;
}

export interface MemberPrivacy {
  readonly visibility?: string;
  readonly pronoun_privacy?: string;
  readonly description_privacy?: string;
  readonly name_privacy?: string;
  readonly birthday_privacy?: string;
  readonly avatar_privacy?: string;
  readonly metadata_privacy?: string;
}

export interface MemberFixtureDef extends FixtureDef<MemberBody> {
  readonly privacy?: MemberPrivacy;
}

export interface GroupBody {
  readonly name: string;
  readonly description?: string | null;
  readonly color?: string | null;
}

export interface GroupFixtureDef extends FixtureDef<GroupBody> {
  /** Refs to member fixtures that belong to this group. */
  readonly members: readonly FixtureRef[];
}

export interface SwitchFixtureDef {
  readonly ref: FixtureRef;
  /** Refs to member fixtures that are fronting in this switch. */
  readonly members: readonly RefOr<string>[];
  /**
   * Timestamp as a negative day offset from now (e.g., -7 = 7 days ago)
   * or an ISO string. Offset 0 means "now".
   */
  readonly timestamp: number | string;
}

/** The full fixture set for a mode. Array order = creation order. */
export interface EntityFixtures {
  readonly members: readonly MemberFixtureDef[];
  readonly groups: readonly GroupFixtureDef[];
  readonly switches: readonly SwitchFixtureDef[];
  /** Optional system description to set after seeding. */
  readonly systemPatch?: { name?: string; description?: string; color?: string };
}
