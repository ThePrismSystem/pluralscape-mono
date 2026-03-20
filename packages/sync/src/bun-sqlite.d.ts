/** Ambient declaration for bun:sqlite — allows tsc to parse test files importing it. */
declare module "bun:sqlite" {
  export class Database {
    constructor(path: string);
    close(): void;
    prepare(sql: string): {
      run(...params: unknown[]): void;
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
    };
    exec(sql: string): void;
    transaction<T>(fn: () => T): () => T;
  }
}
