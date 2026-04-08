/**
 * Minimal type declarations for the `clarinet` SAX-style JSON parser.
 * Only the subset used by `file-source.ts` is declared.
 *
 * clarinet ships as CommonJS with no `.d.ts` — we declare the surface we use
 * so the streaming parser can be typed without `any`.
 */
declare module "clarinet" {
  /**
   * Parser instance returned by `clarinet.parser()`. Events are delivered by
   * assigning callbacks to these properties. clarinet is push-based: callers
   * feed chunks via `write()` and signal completion with `close()`.
   */
  export interface ClarinetParser {
    /** First key fires here as `firstKey`; `undefined` for empty `{}`. */
    onopenobject?: (firstKey?: string) => void;
    oncloseobject?: () => void;
    onopenarray?: () => void;
    onclosearray?: () => void;
    /** Subsequent keys after the first one inside an object. */
    onkey?: (key: string) => void;
    /** String, number, boolean, and null scalar values. */
    onvalue?: (value: string | number | boolean | null) => void;
    onerror?: (err: Error) => void;
    onend?: () => void;
    /** Feed a chunk of UTF-8 text into the parser. Throws if a prior error was set. */
    write(chunk: string): ClarinetParser;
    /** Finalize parsing. Throws if the document is incomplete. */
    close(): ClarinetParser;
  }

  export function parser(opt?: Record<string, unknown>): ClarinetParser;

  const clarinet: {
    parser: typeof parser;
  };

  export default clarinet;
}
