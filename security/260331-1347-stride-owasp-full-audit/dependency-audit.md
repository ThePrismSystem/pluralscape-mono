# Dependency Audit

**Tool:** pnpm audit
**Date:** 2026-03-31
**Result:** No known vulnerabilities found

## Audit Output

```
$ pnpm audit --audit-level=low
No known vulnerabilities found
```

## Security Overrides

The following dependency overrides are configured in the root `package.json` to proactively address known vulnerability patterns:

| Package           | Override                                      | Reason                            |
| ----------------- | --------------------------------------------- | --------------------------------- |
| `better-sqlite3`  | `npm:better-sqlite3-multiple-ciphers@^12.6.2` | AES-256 encryption (SQLCipher)    |
| `node-forge`      | `>=1.4.0`                                     | CVE fixes for crypto operations   |
| `handlebars`      | `>=4.7.9`                                     | Prototype pollution + RCE fixes   |
| `yaml`            | `>=2.8.3`                                     | Code injection via untrusted YAML |
| `picomatch`       | `>=4.0.4`                                     | ReDoS vulnerability               |
| `brace-expansion` | `>=5.0.5`                                     | ReDoS vulnerability               |
| `esbuild`         | `>=0.25.0`                                    | Build tool security patches       |
| `fast-xml-parser` | `>=5.5.7`                                     | XML parsing vulnerability         |
| `flatted`         | `>=3.4.2`                                     | Circular reference handling       |

## CI/CD Integration

- `pnpm audit --audit-level=moderate` runs on every CI build
- Blocks merge if moderate or higher severity vulnerabilities detected
- GitHub Actions versions pinned to full commit SHAs (not branch tags)
- Container images pinned to digest hashes

## Supply Chain Controls

| Control                               | Status                 |
| ------------------------------------- | ---------------------- |
| Lockfile committed                    | Yes (`pnpm-lock.yaml`) |
| Action versions pinned (SHA)          | Yes                    |
| Container digests pinned              | Yes                    |
| Dependency overrides for known CVEs   | Yes                    |
| CI audit gate                         | Yes (moderate+)        |
| No post-install scripts for prod deps | Verified               |
