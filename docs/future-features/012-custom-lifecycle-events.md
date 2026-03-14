# Future Feature: Custom Lifecycle Event Types

## Metadata

| Field                | Value                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Status               | proposed                                                                                                    |
| Category             | structure                                                                                                   |
| Estimated Complexity | medium                                                                                                      |
| Dependencies         | Lifecycle events system, settings UI                                                                        |
| Related Features     | features.md Section 6 (lifecycle events), launch features L8/L9 (structure-move and innerworld-move events) |

## Summary

Currently, lifecycle events have a fixed set of types: split, fusion, merge, unmerge, dormancy-start, dormancy-end, discovery, archival, subsystem-formation, form-change, name-change, structure-move, and innerworld-move. This feature allows systems to define their own custom event types to track system changes that do not fit neatly into the built-in categories.

Custom event type definitions are managed at the system level. Each definition specifies a name, description, applicable fields (which data fields are relevant for events of this type), and optional display properties (icon, color). When recording a lifecycle event, the user can select a custom type alongside the built-in types. Custom events follow the same append-only, immutable model as built-in events. Built-in event types remain hardcoded and are not editable or deletable.

## Motivation

Every system experiences its internal dynamics differently. While the built-in lifecycle event types cover the most common system changes, many systems have experiences that do not map cleanly to these categories. Examples include:

- **Blending episodes**: Two members temporarily sharing traits or blurring boundaries without a full fusion.
- **Walk-ins**: A new member appearing who feels distinctly different from a discovery or split.
- **Age shifts**: A member's perceived age changing significantly.
- **Role changes**: A member transitioning from one system role to another (e.g., a persecutor becoming a protector).
- **System-specific events**: Some systems have recurring internal events with no universal name.

Without custom event types, systems must either shoehorn these experiences into existing categories (losing specificity) or record them only in journal entries (losing the structured, queryable nature of lifecycle events). Custom event types let systems extend the lifecycle tracking system to match their actual experiences.

## Proposed Behavior

### Defining Custom Event Types

In the system settings, a "Custom Lifecycle Events" section lists all defined custom event types. Each definition includes:

- **Name**: A short label for the event type (e.g., "Blending Episode", "Walk-In", "Age Shift").
- **Description**: An optional longer explanation of what this event type represents.
- **Applicable fields**: Which data fields are relevant when recording an event of this type. Options include: affected member(s), notes, date/time, custom data fields, system structure entity references (subsystem, side system, layer), and inner world entity references (regions, entities). This determines which input fields appear in the event creation form.
- **Icon**: An optional icon from the app's icon set.
- **Color**: An optional accent color for timeline display.

### Recording Custom Events

When creating a new lifecycle event, the event type selector shows both built-in types and custom types. Custom types appear in a separate section labeled "Custom" to distinguish them from built-in types. Selecting a custom type shows input fields based on the definition's applicable fields configuration. The resulting event is saved with `eventType: "custom"` and a `definitionId` reference linking it to the custom type definition.

### Timeline Display

Custom events appear in the system timeline alongside built-in events, sorted chronologically. The display uses the custom type's name, icon, and color. If the user defined an icon and color, those are used; otherwise, a default "custom event" appearance is applied.

### Deleting Definitions

Deleting a custom event type definition does not delete events of that type. Lifecycle events are append-only and immutable -- this principle applies equally to custom events. When an event references a deleted definition, the timeline displays it with a fallback label ("Unknown custom event") and a muted appearance. The event's notes and other data remain fully accessible.

### Built-In Types Are Not Editable

Built-in event types (split, fusion, discovery, etc.) are hardcoded and cannot be renamed, recolored, or deleted. They always appear in the event type selector. This ensures consistent semantics across all Pluralscape instances and prevents confusion if a system renames "split" to mean something else.

## Technical Considerations

### Data Model

A new `lifecycle_event_definitions` table (or encrypted blob collection) stores custom type definitions:

- `id`: Unique identifier
- `systemId`: Owning system
- `encryptedBlob`: Contains name, description, applicable fields, icon, and color

Custom lifecycle events use the existing `LifecycleEvent` structure with two additions:

- `eventType` is set to `"custom"` (stored in plaintext for indexing and querying).
- A `definitionId` field references the custom type definition. This is stored in the encrypted blob alongside other event data.

### Type System Extension

The `LifecycleEvent` union type gains a new `CustomLifecycleEvent` variant:

```
CustomLifecycleEvent {
  eventType: "custom"
  definitionId: string
  memberIds: string[]              // affected members (optional per definition)
  structureEntityIds: string[]     // subsystem, side system, or layer refs (optional)
  innerworldEntityIds: string[]    // innerworld region or entity refs (optional)
  notes: string                    // free-text notes (optional per definition)
  customData: Record<string, unknown>  // additional data fields
}
```

The `definitionId` is resolved client-side to display the custom type's name and appearance. If resolution fails (definition deleted), the fallback display is used.

### Definition CRUD

Custom type definitions are simple CRUD entities scoped to a system. There are no cross-system references. The definition management UI is a standard list-detail settings screen. Definitions are synced between devices via the CRDT mechanism, same as other system-level configuration.

### Orphaned Events

When a definition is deleted, events referencing it are not modified (append-only). The client handles orphaned references gracefully:

- Timeline display shows "Unknown custom event" with the event's notes and metadata still visible.
- Filtering by event type still works -- orphaned events can be filtered as "custom (unknown)."
- Data export includes the `definitionId` even if the definition no longer exists, preserving referential integrity for external analysis.

## Privacy and Encryption Implications

Custom event type definitions are T1 encrypted. The name and description of a custom event type are sensitive -- they describe the system's internal experiences and may reference specific members or dynamics. The server stores only encrypted blobs and cannot see definition names, descriptions, or configuration.

The `eventType` field on lifecycle events is stored in plaintext (T3) for server-side indexing, allowing queries like "all lifecycle events" without decryption. For custom events, this value is `"custom"` -- the server knows that a custom event was recorded but cannot distinguish between different custom types. The `definitionId` that identifies the specific custom type is stored inside the encrypted blob, invisible to the server.

Custom event data (notes, affected members, custom fields) follows the same encryption model as built-in lifecycle events. All sensitive content is T1 encrypted. Only timestamps and the generic `"custom"` event type marker are server-visible.

## Open Questions

- Should custom events support custom data fields beyond free-text notes and entity references? For example, a "blending episode" event might want structured fields for "intensity" (numeric) and "members involved" (member list). This overlaps with the custom fields system (future feature 009) and could use the same FieldDefinition mechanism, but scoped to lifecycle events.
- Should custom type definitions have a category or grouping system? Systems with many custom types might want to organize them (e.g., "Internal Events," "Relationship Events," "Therapeutic Events"). This adds UI complexity but improves discoverability.
- How should custom events be handled in data export and import? The export must include both the event data and the type definitions so that imported data can be displayed correctly. If importing into a system that already has different custom types, ID remapping and potential name conflicts must be resolved.
- Should custom types support a "retired" state (hidden from the creation form but still recognized for existing events) as an alternative to deletion? This avoids orphaned events while keeping the creation form clean.
- Should there be a community-contributed library of common custom event types that systems can browse and adopt? This would help systems discover event types they had not thought of, but raises questions about standardization and privacy (publishing a list of event types a system uses could be revealing).
