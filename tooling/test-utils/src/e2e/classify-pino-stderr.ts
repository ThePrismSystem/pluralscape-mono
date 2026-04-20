/**
 * Line-buffered classifier for API server stderr.
 *
 * Splits raw stderr bytes into complete lines (buffering partial lines
 * across chunks) and classifies each line as "forward to stderr" or
 * "suppress as low-level pino noise".
 *
 * Classification rule: parse each line as JSON. If the parsed value is
 * an object with a numeric `level` field, forward only when `level >= 50`
 * (pino ERROR/FATAL). Anything else — non-JSON, missing `level`, non-numeric
 * `level` — falls through to forwarding (fail-open so unknown output is
 * surfaced rather than silently swallowed).
 *
 * The tail always contains every non-empty complete line, classified or
 * not; it feeds the early-exit diagnostic message in pollHealth.
 */

export interface StderrClassifierResult {
  readonly forwarded: string;
  readonly tailLines: readonly string[];
}

export interface StderrClassifier {
  process(chunk: string): StderrClassifierResult;
  flush(): StderrClassifierResult;
}

export interface StderrClassifierOptions {
  readonly prefix?: string;
}

const PINO_ERROR_LEVEL = 50;

function shouldForward(line: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return true;
  }
  if (typeof parsed !== "object" || parsed === null) return true;
  const level = (parsed as { level?: unknown }).level;
  if (typeof level !== "number") return true;
  return level >= PINO_ERROR_LEVEL;
}

export function createStderrClassifier(options: StderrClassifierOptions = {}): StderrClassifier {
  const prefix = options.prefix ?? "";
  let buffer = "";

  function emitLines(lines: readonly string[]): StderrClassifierResult {
    let forwarded = "";
    const tailLines: string[] = [];
    for (const line of lines) {
      if (line === "") continue;
      tailLines.push(line);
      if (shouldForward(line)) {
        forwarded += `${prefix}${line}\n`;
      }
    }
    return { forwarded, tailLines };
  }

  return {
    process(chunk: string): StderrClassifierResult {
      const combined = buffer + chunk;
      const parts = combined.split(/\r?\n/);
      buffer = parts.pop() ?? "";
      return emitLines(parts);
    },
    flush(): StderrClassifierResult {
      if (buffer === "") return { forwarded: "", tailLines: [] };
      const remaining = buffer;
      buffer = "";
      return emitLines([remaining]);
    },
  };
}
