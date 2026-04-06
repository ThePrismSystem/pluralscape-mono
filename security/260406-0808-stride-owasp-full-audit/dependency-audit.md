# Dependency Audit — Pluralscape Full Audit

**Date:** 2026-04-06
**Tool:** `pnpm audit --audit-level=moderate`

## Results

```
No known vulnerabilities found
```

**0 vulnerabilities detected across all severity levels.**

## Security Overrides (pnpm)

The following dependency overrides are configured in the root `package.json` to ensure patched versions are used throughout the monorepo:

| Package           | Minimum Version | Reason                             |
| ----------------- | --------------- | ---------------------------------- |
| `fast-xml-parser` | >=5.5.7         | CVE patches for XML parsing        |
| `node-forge`      | >=1.4.0         | CVE patches for crypto operations  |
| `handlebars`      | >=4.7.9         | CVE patches for template injection |
| `flatted`         | >=3.4.2         | CVE patches for circular JSON      |
| `yaml`            | >=2.8.3         | CVE patches for YAML parsing       |
| `brace-expansion` | >=5.0.5         | ReDoS fix                          |
| `picomatch`       | >=4.0.4         | ReDoS fix                          |
| `esbuild`         | >=0.25.0        | Security patches                   |

## GitHub Actions Pinning

All CI/CD actions are pinned to commit SHAs (not floating version tags):

| Action                             | SHA            | Version |
| ---------------------------------- | -------------- | ------- |
| `actions/checkout`                 | `de0fac2e...`  | v6      |
| `pnpm/action-setup`                | `fc06bc125...` | v5      |
| `actions/setup-node`               | `53b83947...`  | v6      |
| `actions/upload-artifact`          | `bbbca2dd...`  | v7      |
| `schneegans/dynamic-badges-action` | `e9a478b1...`  | v1.7.0  |
| `oven-sh/setup-bun`                | `0c5077e5...`  | v2      |

## Docker Image Pinning

| Image             | Digest               |
| ----------------- | -------------------- |
| `postgres:18`     | `sha256:a9abf427...` |
| `valkey/valkey:9` | `sha256:3b55fbaa...` |

## Lock File

- `pnpm-lock.yaml` is committed and CI uses `--frozen-lockfile`
- No pre/post install scripts besides `husky` (legitimate git hook manager)

## Assessment

**Supply chain security is strong.** Dependencies are actively maintained, overrides address known CVEs, CI/CD actions are SHA-pinned, and Docker images use digest pinning.
