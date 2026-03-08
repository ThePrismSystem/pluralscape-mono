# Security Policy

## The Stakes

Pluralscape handles deeply sensitive psychiatric and personal data — trauma journals, identity information, fronting histories, and internal communications. A security breach in this application can cause real psychological harm. We take this seriously.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report vulnerabilities privately via one of:

- **GitHub Security Advisories**: Use the "Report a vulnerability" button on the Security tab of this repository
- **Email**: pluralscape@proton.me

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

## Response Timeline

- **Acknowledgement**: within 48 hours
- **Initial assessment**: within 7 days
- **Fix or mitigation**: as fast as possible, prioritized by severity

## Scope

The following are in scope:

- The Pluralscape application (all platforms)
- The API and backend services
- The sync infrastructure
- Privacy Bucket access control logic
- Authentication and session management
- Data encryption (at rest and in transit)

## Security Principles

- **Fail-closed**: if a privacy check errors, access is denied — never granted
- **Encryption at rest**: all stored user data is encrypted
- **End-to-end encryption**: data in transit is E2E encrypted
- **No telemetry without opt-in**: we do not collect data about users without explicit consent
- **Audit logging**: security-relevant events are logged for system administrators
- **Offline-first safety**: locally cached data is treated as source of truth until sync is cryptographically verified

## Supported Versions

During early development, only the latest version on `main` is supported. This policy will be updated as the project matures and releases are tagged.
