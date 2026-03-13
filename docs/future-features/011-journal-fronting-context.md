# Future Feature: View Fronting Context on Journal Entries

## Metadata

| Field                | Value                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Status               | proposed                                                                                                    |
| Category             | journaling                                                                                                  |
| Estimated Complexity | low                                                                                                         |
| Dependencies         | Launch feature L3 (fronting snapshot on journal entries), fronting engine                                   |
| Related Features     | features.md Section 2 (fronting), features.md Section 7 (journaling), future feature 009 (therapist report) |

## Summary

When viewing a journal entry, a rich display shows who was fronting at the time the entry was written. This leverages the fronting snapshot captured by launch feature L3, which records the fronting state when a journal entry is created. The display includes member avatars, names, fronting type (fronting vs co-conscious), linked structure placement, and session duration at the time of writing.

If no fronting snapshot was captured for an entry (e.g., entries created before L3 was implemented, or if the user skipped snapshot capture), the view falls back to a best-effort lookup by matching the journal entry's timestamp against fronting session time ranges.

## Motivation

Journal entries are deeply personal records, and understanding who was fronting when an entry was written adds critical context for later review. A journal entry written by a protector during a crisis reads very differently from one written by a little during a calm moment. Systems reviewing their journal history -- especially in a therapeutic context -- benefit enormously from seeing the fronting state alongside the entry content.

Currently, the journal entry records its author (the member who created it), but not the full fronting picture. During co-fronting, multiple members may be influencing the writing even if only one is recorded as the author. Showing the complete fronting context at the time of writing captures this nuance.

This feature also supports future feature 009 (therapist report generation), where fronting context alongside journal entries provides therapists with a richer picture of system dynamics.

## User Stories

- As a system member reviewing old journal entries, I want to see who was fronting when the entry was written so that I can understand the emotional and situational context of what was recorded.
- As a system member, I want to tap on a member shown in the fronting context to navigate to their profile so that I can quickly reference that member's details.
- As a system member, I want the fronting context to show co-fronting information so that I understand the full picture of who was present, not just the primary fronter.
- As a system member, I want a fallback display when no snapshot was captured so that older entries still show approximate fronting context based on fronting history.
- As a system administrator, I want to optionally enable always-visible fronting context on all entries so that our system consistently sees this information without needing to expand a section each time.

## Proposed Behavior

### Fronting Context Bar

When viewing a journal entry, a fronting context bar appears between the entry metadata (date, author, tags) and the entry content. The bar displays:

- **Member avatars**: Small circular avatars for each member who was fronting, arranged left to right.
- **Member names**: Displayed alongside or below avatars, depending on available space.
- **Fronting type indicator**: A subtle badge or icon distinguishing "fronting" (executive control) from "co-conscious" (present but not in control).
- **Structure placement**: If the fronting member belongs to a subsystem, side-system, or layer, that structure name is shown as a secondary label.
- **Session duration**: How long the member had been fronting at the time the entry was created (e.g., "fronting for 2h 15m").

Tapping any member in the context bar navigates to that member's profile screen.

### Snapshot vs Fallback

The view first checks whether the journal entry has an associated `FrontingSnapshot` array in its encrypted data (captured by L3). If present, this is the authoritative source and is displayed directly.

If no snapshot exists, the view performs a fallback lookup: it queries the local fronting history for all fronting sessions where `startTime <= entry.createdAt AND (endTime IS NULL OR endTime >= entry.createdAt)`. This returns the set of members who were fronting at the moment the entry was created. Fallback results are displayed with a subtle indicator (e.g., "approximate" label) so the user knows this is reconstructed rather than captured.

### Edit-Time Context (Optional)

An optional display mode shows fronting context for both the creation time and the last edit time of the entry. This is useful when entries are significantly revised later by a different fronter. The edit-time context uses the same snapshot-or-fallback logic applied to `entry.updatedAt`.

### Settings

A per-system setting controls the default visibility of the fronting context bar:

- **Always show**: The fronting context bar is always visible when viewing any entry.
- **Collapsed by default**: The bar is present but collapsed, requiring a tap to expand.
- **Hidden**: The bar is not shown (useful for systems that do not track fronting).

## Technical Considerations

### Reading Snapshot Data

The `FrontingSnapshot` is an array stored within the journal entry's encrypted blob. Each snapshot element contains a member reference, fronting type, structure reference, and session start time. The UI component deserializes this array and renders the context bar.

### Fallback Query

The fallback query runs against the local decrypted fronting data:

```
SELECT * FROM fronting_sessions
WHERE startTime <= :entryCreatedAt
AND (endTime IS NULL OR endTime >= :entryCreatedAt)
```

This query runs on the client against the local SQLite database containing decrypted fronting sessions. It never touches the server.

### UI Component

The fronting context bar is a reusable component that accepts a list of fronting member snapshots and renders the avatar row with metadata. This component can be reused in other contexts (e.g., therapist reports, timeline views). The component handles edge cases: no members fronting (show "No fronting data"), many co-fronters (scrollable row with overflow indicator), unknown members (show placeholder avatar).

### Navigation

Tapping a member avatar triggers navigation to the member profile screen, passing the member ID. This uses the existing navigation stack.

## Privacy and Encryption Implications

All fronting context data is T1 encrypted. The `FrontingSnapshot` array is stored inside the journal entry's encrypted blob, meaning the server has no visibility into who was fronting when any entry was written.

The fallback lookup queries only local decrypted data. No server request is made to determine fronting state at a given timestamp. The query runs against the local SQLite database, which contains fronting sessions that have already been decrypted during sync.

The fronting context bar does not introduce any new data that the server can observe. It is purely a client-side display feature that combines two existing categories of decrypted data (journal entries and fronting sessions).

If a journal entry is shared via a privacy bucket (e.g., with a therapist through future feature 009), the fronting snapshot is part of the entry blob and would be shared alongside the entry content. The sharing system's per-bucket encryption handles access control.

## Open Questions

- Should the fronting context show changes if fronting changed during a long writing session? For example, if a member started writing, then a switch happened mid-entry, the context could show a timeline of fronting changes during the writing period. This requires tracking entry start time (not just creation/save time).
- How should the context bar display compactly when many members were co-fronting (e.g., 5+ members)? Options include a scrollable row, a "+N more" overflow indicator, or a grid layout.
- Should the fronting context be editable after the fact? If the snapshot was incorrect (e.g., the wrong member was logged as fronting), the user might want to correct it. However, editing a snapshot conflicts with the append-only principle of fronting data. One approach: allow adding a "correction note" without modifying the original snapshot.
