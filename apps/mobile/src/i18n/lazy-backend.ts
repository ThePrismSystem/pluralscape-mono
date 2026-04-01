export interface LazyBackendConfig {
  readonly loadNamespace: (language: string, namespace: string) => Promise<Record<string, string>>;
}

export interface LazyBackend {
  type: "backend";
  read(
    language: string,
    namespace: string,
    callback: (err: Error | null, data: Record<string, string>) => void,
  ): void;
}

export function createLazyBackend(config: LazyBackendConfig): LazyBackend {
  return {
    type: "backend" as const,
    read(
      language: string,
      namespace: string,
      callback: (err: Error | null, data: Record<string, string>) => void,
    ): void {
      config
        .loadNamespace(language, namespace)
        .then((data) => {
          callback(null, data);
        })
        .catch((err: unknown) => {
          callback(err instanceof Error ? err : new Error(String(err)), {});
        });
    },
  };
}
