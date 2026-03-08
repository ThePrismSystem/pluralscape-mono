# ADR 001: AGPL-3.0 License

## Status

Accepted

## Context

Pluralscape is a community-driven plurality management platform serving a vulnerable user base of plural systems. Existing tools in this space have been closed-source and maintained by single developers, an unsustainable model that has led to platform shutdowns and data loss.

We need a license that:

- Ensures the project remains open source permanently
- Prevents proprietary forks from capturing the community without contributing back
- Covers network/hosted deployments (the app includes server-side sync infrastructure)
- Aligns with the project's values of transparency and community ownership

## Decision

We adopt the GNU Affero General Public License v3.0 (AGPL-3.0).

AGPL-3.0 extends GPL-3.0 with a network interaction clause: anyone who modifies the software and offers it as a network service must make the complete source code available to users of that service. This is critical because Pluralscape includes a backend sync service — without the AGPL's network clause, a third party could run a modified, proprietary hosted version without sharing improvements.

## Consequences

- All forks and derivatives must remain open source under AGPL-3.0, including hosted services
- Contributors must agree to license their contributions under AGPL-3.0
- Some organizations with strict copyleft policies may be unable to contribute or integrate — this is an acceptable tradeoff given our priorities
- Self-hosted instances must also make their source available if modified, which aligns with our self-hosting goal (users get both the freedom to host and the guarantee of transparency)
