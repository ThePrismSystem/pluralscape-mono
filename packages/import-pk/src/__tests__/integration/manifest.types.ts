export interface PkManifestEntry {
  readonly ref: string;
  readonly sourceId: string;
  readonly fields: Record<string, unknown>;
}

export interface PkManifest {
  readonly token: string;
  readonly systemId: string;
  readonly mode: "minimal" | "adversarial";
  readonly members: readonly PkManifestEntry[];
  readonly groups: readonly PkManifestEntry[];
  readonly switches: readonly PkManifestEntry[];
}

export type PkManifestCollectionKey = keyof Omit<PkManifest, "token" | "systemId" | "mode">;
