# Future Feature: Linked Fronting (Always-Front-Together Pairs)

## Metadata

| Field                | Value                                                            |
| -------------------- | ---------------------------------------------------------------- |
| Status               | proposed                                                         |
| Category             | fronting                                                         |
| Estimated Complexity | medium                                                           |
| Dependencies         | Front logging (feature spec 2), member profiles (feature spec 1) |
| Related Features     | Co-fronting (feature spec 2), system structure (feature spec 6)  |

## Summary

Linked fronting allows systems to define relationships between members where starting or ending one member's fronting session automatically triggers the same action for linked members. Links can be one-directional (A triggers B but not vice versa) or bidirectional. Links are soft constraints -- users can always override them manually. This feature formalizes patterns that many systems already experience, where certain members always front together or where one member's presence reliably brings another forward.

## Motivation

Many systems have members who consistently front together. This may be due to subsystem relationships, protector dynamics, co-conscious partnerships, or simply the way their system works. Currently, users must manually start and end fronting sessions for each member individually, even when the pairing is predictable. This adds unnecessary friction to front logging and increases the chance of incomplete records (forgetting to log the linked member). By allowing systems to define front links, the app can automate these predictable patterns while keeping the user in control.

## Proposed Behavior

### Link Configuration

In a member's settings, a new "Fronting Links" section allows creating links to other members. Each link specifies:

- **Target member**: the member whose fronting is triggered.
- **Direction**: one-directional (this member triggers the target) or bidirectional (both trigger each other).
- **Trigger actions**: which actions cascade -- start only, end only, or both start and end.

### Fronting Behavior

When a member with outgoing links starts fronting:

1. The app checks for active outgoing links.
2. For each linked target not already fronting, a new fronting session is automatically created.
3. The linked session is marked with a "linked" indicator showing which member triggered it.
4. A brief confirmation toast shows which linked sessions were created (e.g., "Also started fronting: Member B").

When a member with outgoing links ends fronting:

1. The app checks for active outgoing links configured to cascade on end.
2. For each linked target currently fronting via a linked session from this member, the session is ended.
3. If the linked target was also independently fronting (started their own session), only the linked session is ended.

### Override Behavior

Links are soft constraints. At any point, the user can:

- End a linked member's session without ending the triggering member's session.
- Start a linked member's session independently (creating a non-linked session).
- Temporarily disable a link without deleting it.

### Cycle Detection

When creating or modifying links, the app runs cycle detection on the link graph. If adding a link would create a cycle (A -> B -> C -> A), the link is rejected with an explanation. This prevents infinite cascading front triggers.

### Visual Indicators

- Linked sessions show a chain icon or similar indicator in the fronting timeline.
- The link indicator shows the triggering member on hover/tap.
- In the timeline view, linked sessions are visually connected (subtle line or grouping).

## Technical Considerations

- **Data model**: A new `member_front_links` table (or equivalent) with columns: `id`, `source_member_id`, `target_member_id`, `direction` (one-directional or bidirectional), `trigger_on_start` (boolean), `trigger_on_end` (boolean), `enabled` (boolean). Bidirectional links are stored as a single row with a direction flag, not as two separate rows, to avoid consistency issues.
- **Cycle detection**: Implemented as a depth-first search on the directed link graph. Must run on link creation/modification. The graph is small (bounded by member count), so performance is not a concern. For bidirectional links, both directions must be considered in the graph.
- **Maximum chain depth**: Even without cycles, long chains (A -> B -> C -> D -> ...) could cascade extensively. A configurable maximum chain depth (default: 5) prevents unexpectedly long cascades.
- **Fronting engine changes**: The fronting session start/end logic must check for outgoing links and cascade. Cascaded session creation must not re-trigger link checking on the cascaded sessions (to prevent double-cascading in bidirectional links). Use a "triggered by link" flag to suppress re-cascading.
- **Concurrent modifications**: If two members with a bidirectional link both start fronting simultaneously (e.g., on different devices syncing), the CRDT sync layer handles conflict resolution. Each session is an independent CRDT document, so both sessions are preserved.
- **Fronting session metadata**: Linked sessions should store a reference to the triggering session (or triggering member) for auditability.

## Privacy and Encryption Implications

- Link configuration data (which members are linked, directionality, trigger settings) is T1 encrypted. The server cannot see link relationships.
- Linked fronting sessions are created client-side. The server sees individual fronting sessions (with T3 timestamps) but cannot determine that sessions are linked -- the link metadata within each session is T1 encrypted.
- The link graph is reconstructable only on the client with decrypted data.

## Open Questions

- What should the maximum link chain depth be, and should it be configurable per-system? A depth of 5 seems reasonable as a default, but polyfragmented systems with complex structures might need more.
- Should there be a "link group" concept where multiple members are linked as a set (any one triggers all others) rather than defining individual pairwise links?
- How should links interact with custom fronts? Can a member be linked to a custom front (e.g., when member A fronts, the "Blurry" custom front is also automatically logged)?
