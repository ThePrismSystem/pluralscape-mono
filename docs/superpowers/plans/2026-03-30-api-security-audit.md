# API Security Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every REST route for auth/authz, validation/error handling, and rate limiting/headers/CORS — fix low-hanging fruit inline, create follow-up beans for larger issues.

**Architecture:** Three-phase approach: (1) build a reusable audit script that statically inventories all routes and their middleware; (2) manual semantic sweep organized by security domain; (3) TDD-driven fixes for findings. One branch, one PR, commits grouped by bean.

**Tech Stack:** Bun (script runtime), Vitest (tests), Hono (route framework), Zod (validation)

---

## File Structure

| File | Purpose |
|------|---------|
| `scripts/audit-routes.ts` | Permanent route inventory script — static analysis of all route files |
| `scripts/__tests__/audit-routes.test.ts` | Unit tests for the audit script |
| `docs/local-audits/security-audit-2026-03-30.md` | Audit findings report |
| `apps/api/src/lib/parse-json-body.ts` | Add Content-Type enforcement |
| `apps/api/src/__tests__/parse-json-body.test.ts` | Tests for Content-Type enforcement |
| `apps/api/src/middleware/secure-headers.ts` | Add missing headers (X-Content-Type-Options, Cache-Control) |
| `apps/api/src/__tests__/middleware/secure-headers.test.ts` | Updated header tests |
| Various route/service files | Fixes for findings discovered during audit |

---

### Task 1: Create route inventory script — test infrastructure

**Files:**
- Create: `scripts/__tests__/audit-routes.test.ts`
- Create: `scripts/audit-routes.ts`

The audit script statically analyzes route files to build a complete inventory. It walks the route tree starting from `apps/api/src/routes/v1.ts`, follows `.route()` mounts, and extracts middleware/handler info from each file.

- [ ] **Step 1: Write test for route file parsing**

```typescript
// scripts/__tests__/audit-routes.test.ts
import { describe, expect, it } from "vitest";

import { parseRouteFile } from "../audit-routes.js";

describe("parseRouteFile", () => {
  it("extracts rate limit category from createCategoryRateLimiter call", () => {
    const source = `
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
export const createRoute = new Hono<AuthEnv>();
createRoute.use("*", createCategoryRateLimiter("write"));
createRoute.post("/", async (c) => {});
`;
    const result = parseRouteFile(source, "create.ts");
    expect(result.rateLimitCategory).toBe("write");
  });

  it("extracts HTTP method and path from handler", () => {
    const source = `
export const createRoute = new Hono<AuthEnv>();
createRoute.post("/", async (c) => {});
`;
    const result = parseRouteFile(source, "create.ts");
    expect(result.methods).toEqual([{ method: "POST", path: "/" }]);
  });

  it("detects authMiddleware usage", () => {
    const source = `
import { authMiddleware } from "../../middleware/auth.js";
export const systemRoutes = new Hono<AuthEnv>();
systemRoutes.use("*", authMiddleware());
`;
    const result = parseRouteFile(source, "index.ts");
    expect(result.hasAuth).toBe(true);
  });

  it("detects parseJsonBody usage", () => {
    const source = `
import { parseJsonBody } from "../../lib/parse-json-body.js";
createRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);
});
`;
    const result = parseRouteFile(source, "create.ts");
    expect(result.usesParseJsonBody).toBe(true);
  });

  it("detects validation schema imports", () => {
    const source = `
import { MemberListQuerySchema } from "@pluralscape/validation";
listRoute.get("/", async (c) => {});
`;
    const result = parseRouteFile(source, "list.ts");
    expect(result.validationSchemas).toEqual(["MemberListQuerySchema"]);
  });

  it("returns empty results for file with no handlers", () => {
    const source = `
import { Hono } from "hono";
export const routes = new Hono();
routes.route("/foo", fooRoute);
`;
    const result = parseRouteFile(source, "index.ts");
    expect(result.methods).toEqual([]);
    expect(result.rateLimitCategory).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/audit-routes.test.ts 2>&1 | head -30`
Expected: FAIL — `parseRouteFile` not found

- [ ] **Step 3: Implement parseRouteFile**

```typescript
// scripts/audit-routes.ts

export interface RouteMethod {
  method: string;
  path: string;
}

export interface RouteFileInfo {
  hasAuth: boolean;
  rateLimitCategory: string | null;
  usesParseJsonBody: boolean;
  validationSchemas: string[];
  methods: RouteMethod[];
}

const METHOD_PATTERN = /\.(get|post|put|delete|patch)\(\s*["']([^"']+)["']/g;
const RATE_LIMIT_PATTERN = /createCategoryRateLimiter\(\s*["']([^"']+)["']\s*\)/;
const AUTH_MIDDLEWARE_PATTERN = /authMiddleware\(\)/;
const PARSE_JSON_BODY_PATTERN = /parseJsonBody\(/;
const VALIDATION_IMPORT_PATTERN =
  /import\s*\{([^}]+)\}\s*from\s*["']@pluralscape\/validation["']/;

export function parseRouteFile(source: string, _filename: string): RouteFileInfo {
  const methods: RouteMethod[] = [];
  let match: RegExpExecArray | null;
  const methodRegex = new RegExp(METHOD_PATTERN.source, METHOD_PATTERN.flags);
  while ((match = methodRegex.exec(source)) !== null) {
    methods.push({ method: match[1].toUpperCase(), path: match[2] });
  }

  const rateLimitMatch = RATE_LIMIT_PATTERN.exec(source);
  const rateLimitCategory = rateLimitMatch ? rateLimitMatch[1] : null;

  const hasAuth = AUTH_MIDDLEWARE_PATTERN.test(source);
  const usesParseJsonBody = PARSE_JSON_BODY_PATTERN.test(source);

  const validationSchemas: string[] = [];
  const validationMatch = VALIDATION_IMPORT_PATTERN.exec(source);
  if (validationMatch) {
    const imports = validationMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
    validationSchemas.push(...imports.filter((s) => s.endsWith("Schema")));
  }

  return { hasAuth, rateLimitCategory, usesParseJsonBody, validationSchemas, methods };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/__tests__/audit-routes.test.ts 2>&1 | tail -20`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-routes.ts scripts/__tests__/audit-routes.test.ts
git commit -m "feat(scripts): add route file parser for security audit"
```

---

### Task 2: Create route inventory script — tree walker

**Files:**
- Modify: `scripts/audit-routes.ts`
- Modify: `scripts/__tests__/audit-routes.test.ts`

Build the tree walker that starts from `apps/api/src/routes/v1.ts` and recursively follows `.route()` mounts to build the full path tree.

- [ ] **Step 1: Write test for route mount extraction**

```typescript
// Append to scripts/__tests__/audit-routes.test.ts

import { extractRouteMounts } from "../audit-routes.js";

describe("extractRouteMounts", () => {
  it("extracts route mounts from index file", () => {
    const source = `
import { Hono } from "hono";
export const v1Routes = new Hono();
v1Routes.route("/account", accountRoutes);
v1Routes.route("/auth", authRoutes);
`;
    const mounts = extractRouteMounts(source);
    expect(mounts).toEqual([
      { path: "/account", variableName: "accountRoutes" },
      { path: "/auth", variableName: "authRoutes" },
    ]);
  });

  it("extracts mounts with systemId param", () => {
    const source = `
systemRoutes.route("/:systemId/members", memberRoutes);
systemRoutes.route("/:systemId/groups", groupRoutes);
`;
    const mounts = extractRouteMounts(source);
    expect(mounts).toEqual([
      { path: "/:systemId/members", variableName: "memberRoutes" },
      { path: "/:systemId/groups", variableName: "groupRoutes" },
    ]);
  });

  it("extracts mounts with root path", () => {
    const source = `
systemRoutes.route("/", listRoute);
systemRoutes.route("/", getRoute);
`;
    const mounts = extractRouteMounts(source);
    expect(mounts).toEqual([
      { path: "/", variableName: "listRoute" },
      { path: "/", variableName: "getRoute" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/audit-routes.test.ts 2>&1 | tail -20`
Expected: FAIL — `extractRouteMounts` not found

- [ ] **Step 3: Implement extractRouteMounts**

Add to `scripts/audit-routes.ts`:

```typescript
export interface RouteMount {
  path: string;
  variableName: string;
}

const ROUTE_MOUNT_PATTERN = /\.route\(\s*["']([^"']+)["']\s*,\s*(\w+)\s*\)/g;

export function extractRouteMounts(source: string): RouteMount[] {
  const mounts: RouteMount[] = [];
  const regex = new RegExp(ROUTE_MOUNT_PATTERN.source, ROUTE_MOUNT_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    mounts.push({ path: match[1], variableName: match[2] });
  }
  return mounts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/__tests__/audit-routes.test.ts 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-routes.ts scripts/__tests__/audit-routes.test.ts
git commit -m "feat(scripts): add route mount extraction for tree walking"
```

---

### Task 3: Create route inventory script — import resolver and full inventory

**Files:**
- Modify: `scripts/audit-routes.ts`
- Modify: `scripts/__tests__/audit-routes.test.ts`

Resolve import paths from variable names and walk the full tree to produce a complete route inventory. Add CLI entry point that outputs JSON.

- [ ] **Step 1: Write test for import resolution**

```typescript
// Append to scripts/__tests__/audit-routes.test.ts

import { resolveImportPath } from "../audit-routes.js";

describe("resolveImportPath", () => {
  it("resolves relative import to absolute path", () => {
    const source = `
import { memberRoutes } from "../members/index.js";
import { groupRoutes } from "../groups/index.js";
`;
    const result = resolveImportPath(
      source,
      "memberRoutes",
      "/home/user/project/apps/api/src/routes/systems/index.ts",
    );
    expect(result).toBe("/home/user/project/apps/api/src/routes/members/index.ts");
  });

  it("resolves .js extension to .ts", () => {
    const source = `import { createRoute } from "./create.js";`;
    const result = resolveImportPath(
      source,
      "createRoute",
      "/home/user/project/apps/api/src/routes/systems/index.ts",
    );
    expect(result).toBe("/home/user/project/apps/api/src/routes/systems/create.ts");
  });

  it("returns null for unresolvable import", () => {
    const source = `import { Hono } from "hono";`;
    const result = resolveImportPath(
      source,
      "memberRoutes",
      "/home/user/project/apps/api/src/routes/systems/index.ts",
    );
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/audit-routes.test.ts 2>&1 | tail -20`
Expected: FAIL — `resolveImportPath` not found

- [ ] **Step 3: Implement resolveImportPath**

Add to `scripts/audit-routes.ts`:

```typescript
import { dirname, join, resolve } from "node:path";

export function resolveImportPath(
  source: string,
  variableName: string,
  currentFilePath: string,
): string | null {
  // Match: import { variableName } from "path" or import { ..., variableName, ... } from "path"
  const pattern = new RegExp(
    `import\\s*\\{[^}]*\\b${variableName}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`,
  );
  const match = pattern.exec(source);
  if (!match) return null;

  const importPath = match[1];
  // Only resolve relative imports
  if (!importPath.startsWith(".")) return null;

  const dir = dirname(currentFilePath);
  // Replace .js extension with .ts for source files
  const resolved = importPath.replace(/\.js$/, ".ts");
  return resolve(dir, resolved);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/__tests__/audit-routes.test.ts 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Implement full inventory walker and CLI entry point**

Add to `scripts/audit-routes.ts`:

```typescript
import { readFileSync } from "node:fs";

export interface RouteInventoryEntry {
  /** Full API path (e.g., /v1/systems/:systemId/members) */
  fullPath: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Whether auth middleware is applied (directly or inherited from parent router) */
  hasAuth: boolean;
  /** Rate limit category or null if only global */
  rateLimitCategory: string | null;
  /** Whether the handler uses parseJsonBody */
  usesParseJsonBody: boolean;
  /** Zod validation schema names imported from @pluralscape/validation */
  validationSchemas: string[];
  /** Source file path relative to project root */
  sourceFile: string;
}

export function buildInventory(
  entryFile: string,
  basePath: string,
  inheritedAuth: boolean,
): RouteInventoryEntry[] {
  const source = readFileSync(entryFile, "utf-8");
  const fileInfo = parseRouteFile(source, entryFile);
  const mounts = extractRouteMounts(source);
  const currentAuth = inheritedAuth || fileInfo.hasAuth;
  const entries: RouteInventoryEntry[] = [];

  // If this file has HTTP method handlers, record them
  for (const m of fileInfo.methods) {
    const fullPath = normalizePath(basePath + m.path);
    entries.push({
      fullPath,
      method: m.method,
      hasAuth: currentAuth,
      rateLimitCategory: fileInfo.rateLimitCategory,
      usesParseJsonBody: fileInfo.usesParseJsonBody,
      validationSchemas: fileInfo.validationSchemas,
      sourceFile: entryFile,
    });
  }

  // Recurse into mounted sub-routers
  for (const mount of mounts) {
    const childPath = resolveImportPath(source, mount.variableName, entryFile);
    if (!childPath) continue;
    const mountPath = normalizePath(basePath + mount.path);
    try {
      const childEntries = buildInventory(childPath, mountPath, currentAuth);
      entries.push(...childEntries);
    } catch {
      // File not found or unresolvable — skip (will be flagged as gap)
    }
  }

  return entries;
}

function normalizePath(p: string): string {
  return p.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

// ── CLI entry point ──────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const projectRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
  const entryFile = join(projectRoot, "apps/api/src/routes/v1.ts");
  const inventory = buildInventory(entryFile, "/v1", false);

  const flagged = inventory.filter(
    (e) =>
      !e.hasAuth ||
      e.rateLimitCategory === null ||
      (e.usesParseJsonBody && e.validationSchemas.length === 0),
  );

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(inventory, null, 2));
  } else if (process.argv.includes("--flagged")) {
    console.log(JSON.stringify(flagged, null, 2));
  } else {
    console.log(`Total routes: ${inventory.length}`);
    console.log(`Missing auth: ${inventory.filter((e) => !e.hasAuth).length}`);
    console.log(`No rate limit tier: ${inventory.filter((e) => !e.rateLimitCategory).length}`);
    console.log(`Uses parseJsonBody without validation: ${
      inventory.filter((e) => e.usesParseJsonBody && e.validationSchemas.length === 0).length
    }`);
    console.log(`\nFlagged routes:`);
    for (const e of flagged) {
      const flags = [];
      if (!e.hasAuth) flags.push("NO_AUTH");
      if (!e.rateLimitCategory) flags.push("NO_RATE_LIMIT");
      if (e.usesParseJsonBody && e.validationSchemas.length === 0) flags.push("NO_VALIDATION");
      console.log(`  ${e.method} ${e.fullPath} [${flags.join(", ")}]`);
    }
  }
}
```

- [ ] **Step 6: Run tests and verify the script works against the real codebase**

Run: `pnpm vitest run scripts/__tests__/audit-routes.test.ts 2>&1 | tail -20`
Expected: All tests PASS

Then run the script against the real codebase:
Run: `bun scripts/audit-routes.ts --json > .tmp/route-inventory.json 2>&1 && jq 'length' .tmp/route-inventory.json`
Expected: A number > 200 (the total route count)

Run: `bun scripts/audit-routes.ts`
Expected: Summary table with flagged routes

- [ ] **Step 7: Commit**

```bash
git add scripts/audit-routes.ts scripts/__tests__/audit-routes.test.ts
git commit -m "feat(scripts): complete route inventory script with tree walker and CLI"
```

---

### Task 4: Run audit inventory and analyze results

**Files:**
- Create: `docs/local-audits/security-audit-2026-03-30.md`

Run the inventory script, review the output, and create the initial audit report structure.

- [ ] **Step 1: Run the inventory script and save output**

```bash
bun scripts/audit-routes.ts --json > .tmp/route-inventory.json 2>&1
bun scripts/audit-routes.ts > .tmp/route-inventory-summary.txt 2>&1
bun scripts/audit-routes.ts --flagged > .tmp/route-inventory-flagged.json 2>&1
```

- [ ] **Step 2: Review the flagged routes**

Read `.tmp/route-inventory-flagged.json` and categorize each flagged route:
- Routes missing auth that SHOULD be public (login, register, password-reset, recovery-key, biometric, health) — expected, not a finding
- Routes missing auth that SHOULD be protected — critical finding
- Routes with no rate limit tier beyond global — check if they should have one
- Routes using parseJsonBody without validation schema imports — check if validation happens in the service layer (note: the script only detects `@pluralscape/validation` imports in the route file, not service-layer validation)

- [ ] **Step 3: Create the audit report skeleton**

Create `docs/local-audits/security-audit-2026-03-30.md` with this structure:

```markdown
# API Security Audit — 2026-03-30

Covers beans: api-sojx (auth/authz), api-69ul (validation/errors), api-3b2d (rate limiting/headers/CORS).

## Route Inventory Summary

Total routes: [N]
Missing auth (expected public): [N]
Missing auth (unexpected): [N]
No rate limit tier: [N]
No validation schema detected: [N]

## Findings

### Critical

### High

### Medium

### Low

## Auth/Authz (api-sojx)

### Auth Middleware Coverage

[Paste route inventory results — which routes have auth, which don't]

### IDOR / Ownership Checks

[Findings from manual review]

### Session Management

[Findings from manual review]

### Password / Recovery Key / 2FA

[Findings from manual review]

## Input Validation (api-69ul)

### Zod Schema Coverage

[Findings from route inventory + manual review]

### Injection Prevention

[Findings from manual review]

### Error Handling Safety

[Findings from manual review]

## Rate Limiting / Headers / CORS (api-3b2d)

### Rate Limit Tier Assignments

[Findings from route inventory + manual review]

### Security Headers

[Findings from manual review]

### CORS Configuration

[Findings from manual review]

## Follow-Up Beans Created

[List of beans created for larger issues]
```

- [ ] **Step 4: Commit the skeleton**

```bash
git add docs/local-audits/security-audit-2026-03-30.md
git commit -m "docs: create security audit report skeleton with route inventory"
```

---

### Task 5: Manual audit — auth/authz (api-sojx)

**Files:**
- Modify: `docs/local-audits/security-audit-2026-03-30.md`

Systematic manual review of authentication and authorization across all routes.

- [ ] **Step 1: Verify auth middleware coverage**

Using the route inventory from Task 4, verify:
- All routes under `/v1/systems/*` and `/v1/account/*` inherit auth from their parent router (`systemRoutes.use("*", authMiddleware())` in `apps/api/src/routes/systems/index.ts:48` and `accountRoutes.use("*", authMiddleware())` in `apps/api/src/routes/account/index.ts:21`)
- All routes under `/v1/auth/*` are public EXCEPT `/v1/auth/sessions` which applies its own auth (`apps/api/src/routes/auth/sessions.ts`)
- `/v1/notifications` applies auth — verify in `apps/api/src/routes/notifications/index.ts`

For each, read the index file and confirm the `authMiddleware()` call.

- [ ] **Step 2: Audit IDOR prevention on system-scoped routes**

For every route under `/v1/systems/:systemId/*`, verify that the handler or service checks that the authenticated account owns the target system. The pattern should be:
1. `auth.ownedSystemIds` is checked against the `systemId` param, OR
2. The service query joins on `system_id` and the auth context's account

Read these representative service files and check ownership verification:
- `apps/api/src/services/member.service.ts` — check `createMember`, `listMembers`, `getMember`, `updateMember`, `deleteMember`
- `apps/api/src/services/group.service.ts` — check CRUD operations
- `apps/api/src/services/fronting.service.ts` — check fronting operations
- `apps/api/src/services/blob.service.ts` — check blob upload/download

Look for the pattern: does each service verify `systemId` belongs to `auth.ownedSystemIds` or equivalent? Document any gaps.

- [ ] **Step 3: Audit account-scoped routes for ownership**

For routes under `/v1/account/*`, verify they use `auth.accountId` to scope queries. Read:
- `apps/api/src/routes/account/get.ts`
- `apps/api/src/routes/account/delete.ts`
- `apps/api/src/services/account.service.ts`

- [ ] **Step 4: Audit session management**

Read these files and verify:
- `apps/api/src/lib/session-token.ts` — token entropy (should be >= 256 bits, already confirmed as 32 bytes)
- `apps/api/src/lib/session-auth.ts` — session validation (expiration, revocation, idle timeout)
- `apps/api/src/services/auth.service.ts` — session creation, logout, password change session handling

Check: Does password change invalidate other sessions? Does recovery key flow require current auth? Is session revocation immediate?

- [ ] **Step 5: Audit 2FA flows**

Search for TOTP/2FA related code:
```bash
grep -r "totp\|2fa\|two.factor\|twoFactor" apps/api/src/ --include="*.ts" -l
```

If 2FA exists, verify: time window validation, replay prevention, enrollment requires auth, disenrollment requires auth.

- [ ] **Step 6: Audit device transfer and biometric flows**

Read:
- `apps/api/src/routes/auth/biometric.ts` (or biometric route file)
- `apps/api/src/routes/account/device-transfer.ts`
- Corresponding services

Check: challenge-response integrity, no token reuse in device transfer, secure handoff.

- [ ] **Step 7: Audit unauthenticated routes for data leakage**

Read login, register, password-reset, recovery-key route handlers. Verify:
- Failed login does not reveal whether email exists (generic error message)
- Registration does not reveal whether email is taken in a distinguishable way
- Password reset does not confirm email existence
- Error messages are generic and don't leak internal state

Check `apps/api/src/routes/auth/auth.constants.ts` for the `AUTH_GENERIC_LOGIN_ERROR` constant (already seen in login.ts).

- [ ] **Step 8: Update audit report with auth/authz findings**

Document all findings in `docs/local-audits/security-audit-2026-03-30.md` under the Auth/Authz section. Categorize by severity (critical/high/medium/low).

- [ ] **Step 9: Commit**

```bash
git add docs/local-audits/security-audit-2026-03-30.md
git commit -m "docs: complete auth/authz security audit findings (api-sojx)"
```

---

### Task 6: Manual audit — input validation and error handling (api-69ul)

**Files:**
- Modify: `docs/local-audits/security-audit-2026-03-30.md`

- [ ] **Step 1: Audit Zod validation coverage**

Using the route inventory, identify all routes that accept request bodies (`usesParseJsonBody: true`). For each, verify that the corresponding service has a Zod schema validation.

Check representative services:
- `apps/api/src/services/member.service.ts` — uses `CreateMemberBodySchema.safeParse()`
- `apps/api/src/services/group.service.ts`
- `apps/api/src/services/custom-front.service.ts`
- `apps/api/src/services/auth.service.ts` — uses `RegistrationInputSchema.parse()`

For each service: does it validate ALL input or just some fields? Are there string length limits? Array length limits?

- [ ] **Step 2: Audit validation schemas for field constraints**

Read schema files in `packages/validation/src/` and check:
- String fields have `.max()` constraints (prevent storage abuse)
- Array fields have `.max()` constraints
- Numeric fields have `.min()/.max()` range constraints
- UUID fields use proper format validation

Spot-check at least 5 schema files:
- `packages/validation/src/auth.ts`
- `packages/validation/src/member.ts`
- `packages/validation/src/group.ts`
- `packages/validation/src/fronting.ts`
- `packages/validation/src/channel.ts`

- [ ] **Step 3: Audit path and query parameter validation**

Verify `requireIdParam()` (in `apps/api/src/lib/id-param.ts`) is used for all ID parameters. It validates prefix and UUID format — confirm this is used consistently.

Grep for direct `.param()` usage without `requireIdParam`:
```bash
grep -n "c.req.param\|req.param" apps/api/src/routes/ -r --include="*.ts" | grep -v requireIdParam | grep -v requireParam
```

Any direct param access without validation is a finding.

- [ ] **Step 4: Audit Content-Type enforcement**

`parseJsonBody()` in `apps/api/src/lib/parse-json-body.ts` does NOT check Content-Type before parsing. This is a known finding — Hono's `c.req.json()` will attempt to parse regardless of Content-Type header.

Document this as a finding. Fix will be implemented in Task 8.

- [ ] **Step 5: Audit for injection vectors**

Verify no raw SQL construction:
```bash
grep -rn "sql\`\|\.execute\s*(\|\.raw\s*(" apps/api/src/ --include="*.ts" | grep -v node_modules | grep -v __tests__
```

Check for any Drizzle `.sql` tagged template usage that interpolates user input. Drizzle's query builder is safe, but raw SQL templates could be vulnerable if user input is concatenated.

Verify no path traversal in blob operations — read `apps/api/src/services/blob.service.ts` and check how file paths are constructed.

- [ ] **Step 6: Audit error response safety**

The error handler (`apps/api/src/middleware/error-handler.ts`) already masks 5xx in production. Verify:
- ZodError details are stripped in production (line 104: `isProduction ? undefined : err`)
- No service throws errors with internal details (table names, file paths) in the message field
- 4xx error messages are generic enough (check a sample of `ApiHttpError` throw sites)

Grep for potentially leaky error messages:
```bash
grep -rn "ApiHttpError" apps/api/src/services/ --include="*.ts" | head -30
```

Review the error messages for internal detail leakage.

- [ ] **Step 7: Audit pagination and DoS prevention**

Check list endpoints for pagination limits:
- `apps/api/src/lib/pagination.ts` — how does `parsePaginationLimit` enforce max?
- Are there any list endpoints that don't use pagination?
- Is there a global query timeout or row limit?

- [ ] **Step 8: Update audit report with validation/error findings**

Document all findings in `docs/local-audits/security-audit-2026-03-30.md` under the Validation section.

- [ ] **Step 9: Commit**

```bash
git add docs/local-audits/security-audit-2026-03-30.md
git commit -m "docs: complete validation/error handling audit findings (api-69ul)"
```

---

### Task 7: Manual audit — rate limiting, headers, and CORS (api-3b2d)

**Files:**
- Modify: `docs/local-audits/security-audit-2026-03-30.md`

- [ ] **Step 1: Audit rate limit tier assignments**

Using the route inventory, create a table of every endpoint's rate limit tier. Flag endpoints where the tier seems inappropriate:
- Login/register/password-reset should use `authHeavy` (5/min) — verify
- Session management should use `authLight` (20/min) — verify
- Read-only list endpoints should use `readDefault` (60/min) or `readHeavy` (30/min) — verify
- Write endpoints should use `write` (60/min) — verify
- Blob upload should use `blobUpload` (20/min) — verify
- Device transfer should use `deviceTransfer` (10/min) — verify
- Friend code operations should use dedicated tiers — verify

Check for any endpoints using a tier that's too permissive for their sensitivity.

- [ ] **Step 2: Audit DISABLE_RATE_LIMIT production guard**

Already confirmed in exploration: `apps/api/src/env.ts:17-28` forces `false` in production, and `apps/api/src/index.ts:131-133` throws on startup if enabled outside test. This is well-guarded. Document as passing.

- [ ] **Step 3: Audit security headers**

Read response headers from the test in `apps/api/src/__tests__/middleware/secure-headers.test.ts` and verify completeness:
- `Content-Security-Policy`: has `default-src 'self'`, `frame-ancestors 'none'` — PASS
- `X-Frame-Options: DENY` — PASS
- `Strict-Transport-Security` in production — PASS
- `Permissions-Policy` (camera, microphone, geolocation denied) — PASS
- `Referrer-Policy: no-referrer` — PASS
- `X-Content-Type-Options: nosniff` — check if Hono's `secureHeaders()` sets this by default. If not, it's a finding.

Check whether `X-Powered-By` is present:
```bash
grep -rn "x-powered-by\|X-Powered-By" apps/api/src/ --include="*.ts"
```

If Hono sets it by default, it needs to be removed.

- [ ] **Step 4: Audit Cache-Control on sensitive responses**

Check whether auth-related endpoints (login, session list, account info) set `Cache-Control: no-store` or similar. Read:
- `apps/api/src/routes/auth/login.ts` — check response headers
- `apps/api/src/routes/account/get.ts` — check response headers

If no Cache-Control is set on sensitive endpoints, document as a finding.

- [ ] **Step 5: Audit CORS configuration**

The CORS middleware (`apps/api/src/middleware/cors.ts`) already:
- Rejects bare `*` — PASS
- Reads from `CORS_ORIGIN` env — PASS
- Returns no CORS headers when `CORS_ORIGIN` is unset — PASS (secure default)

Check `credentials` mode — is `credentials: true` set? Read `apps/api/src/middleware/cors.ts` line 37-42. If credentials are allowed, verify it works correctly with the origin check (no wildcard + credentials).

Check: is `ALLOWED_ORIGINS` env var (in `apps/api/src/env.ts:30`) used anywhere? If not, it may be dead config.

- [ ] **Step 6: Audit TRUST_PROXY and X-Forwarded-For**

Already confirmed in exploration: `apps/api/src/middleware/rate-limit.ts:43-58` handles this correctly:
- Without TRUST_PROXY, all requests share global bucket (safe but coarse)
- With TRUST_PROXY, parses first IP from XFF with validation
- Warns once if XFF present without TRUST_PROXY

Document as passing with a note about the global bucket limitation.

- [ ] **Step 7: Update audit report with rate limit/header/CORS findings**

Document all findings in `docs/local-audits/security-audit-2026-03-30.md` under the Rate Limiting section.

- [ ] **Step 8: Commit**

```bash
git add docs/local-audits/security-audit-2026-03-30.md
git commit -m "docs: complete rate limiting/headers/CORS audit findings (api-3b2d)"
```

---

### Task 8: Fix — Content-Type enforcement in parseJsonBody

**Files:**
- Modify: `apps/api/src/lib/parse-json-body.ts`
- Modify or create: `apps/api/src/__tests__/parse-json-body.test.ts`

Known finding from Task 6: `parseJsonBody()` does not check the Content-Type header before attempting JSON parse.

- [ ] **Step 1: Write failing test for Content-Type enforcement**

```typescript
// apps/api/src/__tests__/parse-json-body.test.ts
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { parseJsonBody } from "../../lib/parse-json-body.js";

function createTestApp() {
  const app = new Hono();
  app.post("/test", async (c) => {
    const body = await parseJsonBody(c);
    return c.json({ received: body });
  });
  return app;
}

describe("parseJsonBody", () => {
  it("parses valid JSON with correct Content-Type", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toEqual({ name: "test" });
  });

  it("accepts Content-Type with charset parameter", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects request with wrong Content-Type", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(415);
    const data = await res.json();
    expect(data.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects request with no Content-Type", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(415);
  });

  it("rejects request with invalid JSON body", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/api/src/__tests__/parse-json-body.test.ts 2>&1 | tail -20`
Expected: FAIL — Content-Type rejection tests fail (currently no Content-Type check)

- [ ] **Step 3: Implement Content-Type enforcement**

Check if `UNSUPPORTED_MEDIA_TYPE` exists in the ApiErrorCode type. If not, check `packages/types/src/` for the error code union. The error handler already maps 415 to `VALIDATION_ERROR` in `STATUS_TO_CODE`, so use a specific code.

Modify `apps/api/src/lib/parse-json-body.ts`:

```typescript
import { HTTP_BAD_REQUEST, HTTP_UNSUPPORTED_MEDIA_TYPE } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { Context } from "hono";

export async function parseJsonBody(c: Context): Promise<unknown> {
  const contentType = c.req.header("content-type");
  if (!contentType || !contentType.startsWith("application/json")) {
    throw new ApiHttpError(
      HTTP_UNSUPPORTED_MEDIA_TYPE,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json",
    );
  }

  try {
    return await c.req.json();
  } catch (cause: unknown) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body", { cause });
  }
}
```

Note: `HTTP_UNSUPPORTED_MEDIA_TYPE` (415) may need to be added to `apps/api/src/http.constants.ts`. Check if it exists; if not, add it. Also verify `UNSUPPORTED_MEDIA_TYPE` is in the `ApiErrorCode` union in `packages/types/src/` — if not, add it there too.

Wrap the error handler in Hono's `app.onError` so the global error handler will need `415 → "UNSUPPORTED_MEDIA_TYPE"` in the `STATUS_TO_CODE` map (or rely on the fallback).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/api/src/__tests__/parse-json-body.test.ts 2>&1 | tail -20`
Expected: All 5 tests PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `pnpm test:unit > .tmp/unit-test-output.txt 2>&1`
Read `.tmp/unit-test-output.txt` and check for failures. Existing tests that send POST requests without a Content-Type header may break — fix them by adding the header.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/parse-json-body.ts apps/api/src/__tests__/parse-json-body.test.ts
# Also add any modified files (http.constants.ts, types, error-handler.ts, fixed tests)
git commit -m "fix(api): enforce Content-Type application/json on parseJsonBody"
```

---

### Task 9: Fix audit findings — apply TDD fixes

**Files:** Varies per finding

For EACH finding from the audit report (Tasks 5-7) that qualifies as low-hanging fruit:

- [ ] **Step 1: Triage findings from the audit report**

Read `docs/local-audits/security-audit-2026-03-30.md`. For each finding, classify:
- **Fix inline**: Missing header, wrong rate limit tier, missing validation constraint, error message leaking detail
- **Follow-up bean**: Architectural change, API contract change, needs design discussion

- [ ] **Step 2: For each inline fix, apply the TDD cycle**

For each fix:

1. Write a failing test that proves the vulnerability exists
2. Run it to verify it fails
3. Apply the minimal fix
4. Run the test to verify it passes
5. Run the broader test suite to check for regressions

Group related fixes into logical commits:
- Auth fixes: `fix(api): [description of auth fixes]`
- Validation fixes: `fix(api): [description of validation fixes]`
- Rate limit/header fixes: `fix(api): [description of rate limit/header fixes]`

- [ ] **Step 3: Run full verification after all fixes**

```bash
pnpm format > .tmp/format-output.txt 2>&1
pnpm lint > .tmp/lint-output.txt 2>&1
pnpm typecheck > .tmp/typecheck-output.txt 2>&1
pnpm test:unit > .tmp/unit-test-output.txt 2>&1
pnpm test:integration > .tmp/integration-test-output.txt 2>&1
```

Read each output file and verify zero failures.

---

### Task 10: Create follow-up beans for larger findings

**Files:**
- Modify: `docs/local-audits/security-audit-2026-03-30.md`

- [ ] **Step 1: Create beans for each finding that needs design work**

For each finding classified as "follow-up bean" in Task 9:

```bash
beans create "Title describing the finding" -t bug --prefix api- -d "Description of the issue and recommended fix approach" -s todo --blocked-by api-sojx  # or appropriate bean
```

Use type `bug` for security issues, `task` for improvements.

- [ ] **Step 2: Update the audit report with follow-up bean references**

Add each created bean ID to the "Follow-Up Beans Created" section of the audit report.

- [ ] **Step 3: Commit**

```bash
git add docs/local-audits/security-audit-2026-03-30.md .beans/
git commit -m "docs: add follow-up beans from security audit findings"
```

---

### Task 11: Complete beans and final verification

**Files:**
- Modify: `.beans/api-sojx--*.md`
- Modify: `.beans/api-69ul--*.md`
- Modify: `.beans/api-3b2d--*.md`

- [ ] **Step 1: Run E2E tests**

```bash
pnpm test:e2e > .tmp/e2e-test-output.txt 2>&1
```

Read `.tmp/e2e-test-output.txt` and verify zero failures.

- [ ] **Step 2: Update bean api-sojx with Summary of Changes**

```bash
beans update api-sojx -s completed --body-append "## Summary of Changes

[List of auth/authz findings and fixes applied]"
```

Check off all completed checklist items using `--body-replace-old`/`--body-replace-new`.

- [ ] **Step 3: Update bean api-69ul with Summary of Changes**

```bash
beans update api-69ul -s completed --body-append "## Summary of Changes

[List of validation/error handling findings and fixes applied]"
```

- [ ] **Step 4: Update bean api-3b2d with Summary of Changes**

```bash
beans update api-3b2d -s completed --body-append "## Summary of Changes

[List of rate limiting/header/CORS findings and fixes applied]"
```

- [ ] **Step 5: Final commit with bean updates**

```bash
git add .beans/ docs/local-audits/security-audit-2026-03-30.md
git commit -m "chore: complete security audit beans with summaries"
```
