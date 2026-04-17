import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, extname, posix as posixPath, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 10_098;
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist");
const DIST_PREFIX = DIST + sep;

const mime: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
};

function safeResolve(rawUrl: string): string | null {
  const withoutQuery = rawUrl.split("?")[0]?.split("#")[0] ?? "/";
  const normalized = posixPath.normalize(withoutQuery);
  if (!normalized.startsWith("/") || normalized.includes("\0")) return null;
  const requestPath = normalized === "/" ? "/index.html" : normalized;
  const candidate = resolve(DIST, "." + requestPath);
  if (candidate !== DIST && !candidate.startsWith(DIST_PREFIX)) return null;
  return candidate;
}

export function startHarnessServer(): Promise<{ close(): Promise<void>; server: Server }> {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      const file = safeResolve(req.url ?? "/");
      if (file === null) {
        res.statusCode = 403;
        res.end("forbidden");
        return;
      }
      if (!existsSync(file)) {
        res.statusCode = 404;
        res.end("not found");
        return;
      }
      res.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
      createReadStream(file).pipe(res);
    });
    server.listen(PORT, () => {
      resolvePromise({
        server,
        close: () =>
          new Promise((r) => {
            server.close(() => {
              r();
            });
          }),
      });
    });
  });
}
