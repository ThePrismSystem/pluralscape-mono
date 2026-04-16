import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 10_098;
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist");

const mime: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
};

export function startHarnessServer(): Promise<{ close(): Promise<void>; server: Server }> {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      const url = req.url ?? "/";
      const path = url === "/" ? "/index.html" : url;
      const file = join(DIST, path);
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
