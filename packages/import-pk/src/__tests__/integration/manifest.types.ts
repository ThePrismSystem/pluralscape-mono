export interface PkMemberFields {
  readonly name: string;
}

export interface PkGroupFields {
  readonly name: string;
}

export interface PkSwitchFields {
  readonly timestamp: string;
}

export interface PkManifestEntry<F = PkMemberFields> {
  readonly ref: string;
  readonly sourceId: string;
  readonly fields: F;
}

export interface PkManifest {
  readonly token: string;
  readonly systemId: string;
  readonly mode: "minimal" | "adversarial";
  readonly expectedSessionCount: number;
  readonly members: readonly PkManifestEntry[];
  readonly groups: readonly PkManifestEntry<PkGroupFields>[];
  readonly switches: readonly PkManifestEntry<PkSwitchFields>[];
}

export type PkManifestCollectionKey = keyof Omit<
  PkManifest,
  "token" | "systemId" | "mode" | "expectedSessionCount"
>;
