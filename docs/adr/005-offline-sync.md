# ADR 005: Offline-First Sync — Custom CRDT with Automerge

## Status

Accepted

## Context

The app is offline-first: users log fronting shifts, write chat messages, and edit member profiles without network connectivity. Changes must sync reliably when reconnected, with cryptographic verification that data reached the server. The sync layer must work with E2E encryption (the server stores ciphertext only).

Requirements:

- Conflict-free resolution without server involvement
- Works with E2E encrypted payloads (server cannot merge — it can't read the data)
- No vendor lock-in
- License compatible with AGPL-3.0
- Self-hosting friendly

Evaluated: PowerSync, custom CRDT (Automerge), Replicache/Zero, ElectricSQL.

## Decision

Custom CRDT-based sync using **Automerge** as the CRDT library.

Key factors:

- **No vendor lock-in**: The sync protocol is fully under our control. No dependency on a third-party service with incompatible licensing.
- **License clean**: Automerge is MIT. PowerSync's server component is FSL (Functional Source License) — not open source, not AGPL-compatible for distribution.
- **E2E encryption compatibility**: CRDT documents can be encrypted client-side before sync. The server is a dumb relay of encrypted CRDT operations — it never needs to read or merge data.
- **Conflict-free by design**: Fronting logs (append-only), chat messages (append-only), and member profile edits (last-writer-wins per field) all map naturally to CRDT semantics.
- **No server dependency for resolution**: Conflicts resolve on the client, which aligns with the zero-knowledge server model.

Automerge specifics:

- JSON-based CRDT with Rust core + WASM bindings for high performance
- Supports nested objects, lists, counters, and text
- Document-per-entity topology (e.g., one CRDT document per system, or per collection)

Rejected alternatives:

- **PowerSync**: Production-ready and well-designed, but server component is FSL-licensed (not open source, incompatible with AGPL-3.0 distribution). Would create vendor dependency for a core feature.
- **Replicache/Zero**: Closed-source (Replicache) or alpha-stage (Zero). 100MB dataset limitation.
- **ElectricSQL**: Open alpha, team explicitly discourages production use. Write path not implemented.

## Consequences

- Significant upfront engineering investment compared to adopting PowerSync
- Must design document/topic topology carefully (per-system? per-collection? per-entity?)
- Document size management requires garbage collection and pruning strategies
- No built-in partial replication — must design which CRDT documents each client subscribes to
- Must layer encryption on top (Automerge doesn't handle encryption natively)
- The sync protocol becomes a core competency of the project, not a pluggable dependency

### License

Automerge: MIT. Compatible with AGPL-3.0.
