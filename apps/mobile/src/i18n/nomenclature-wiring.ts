export interface NomenclatureConfig {
  readonly systemNomenclature?: string;
  readonly memberNomenclature?: string;
}

export function resolveNomenclatureFromSettings(
  settings: NomenclatureConfig | null,
): Record<string, string> {
  if (!settings) return {};
  return {
    ...(settings.systemNomenclature ? { system: settings.systemNomenclature } : {}),
    ...(settings.memberNomenclature ? { member: settings.memberNomenclature } : {}),
  };
}
