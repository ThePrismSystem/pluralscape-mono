# Future Feature: Member Creation Templates

## Metadata

| Field                | Value                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Status               | proposed                                                                                  |
| Category             | identity                                                                                  |
| Estimated Complexity | medium                                                                                    |
| Dependencies         | Member profiles, custom fields system, groups, structure (subsystems/side-systems/layers) |
| Related Features     | features.md Section 1 (identity)                                                          |

## Summary

Member creation templates are reusable, system-level entities that store pre-filled field values and configuration defaults for new members. When creating a new member, the user can select a template to pre-populate fields, reducing repetitive data entry and ensuring consistency across members that share common traits.

Templates store default values for: custom fields, group memberships, structure placements (subsystem, side-system, or layer), tags, and notification preferences. Templates are managed in a dedicated settings screen and can be created from scratch or generated from an existing member's current data ("save as template"). Template selection is offered during the new member creation flow.

## Motivation

Systems with many members often find that new members share common characteristics with existing ones. A system with a well-established subsystem structure may discover new members who belong to the same subsystem and share similar roles, tags, and custom field values. Without templates, the user must manually configure each new member from scratch, re-entering the same group memberships, structure placements, and field values each time.

Templates are especially valuable for systems that experience frequent discoveries or splits. Rather than spending time on repetitive configuration, the user can select a template and adjust only what is different about the new member. This also helps maintain consistency -- if a system has a convention that all littles belong to a specific group and have certain notification settings, a "Little" template encodes that convention.

The "save as template" feature makes template creation low-friction. Rather than manually building a template from scratch, a user can take a well-configured member and save their current settings as a reusable starting point.

## Proposed Behavior

### Template Management

A "Member Templates" section in the system settings screen lists all defined templates. Each template has a name and an optional description. The user can create new templates, edit existing ones, or delete templates that are no longer needed.

When creating or editing a template, the user sees a form that mirrors the member creation form, with all fields optional. The user fills in only the values they want to pre-populate:

- **Custom field defaults**: For each defined custom field, an optional default value.
- **Group memberships**: A list of groups the new member should be added to.
- **Structure placement**: A default subsystem, side-system, or layer.
- **Tags**: A set of default tags.
- **Notification preferences**: Default notification settings for the new member.

### Save as Template

On any existing member's profile, an action menu includes "Save as Template." This creates a new template pre-filled with the member's current values for all template-supported fields. The user can then edit the template name and adjust any values before saving.

### Template Selection During Member Creation

The member creation flow begins with an optional template selection step. The user sees a list of available templates (with names and descriptions) and can select one or skip to start from scratch. Selecting a template pre-populates all fields with the template's default values. The user can then modify any pre-populated value before saving the new member.

### Handling Stale References

Templates store references to custom field definitions, groups, and structure entities by ID. If a referenced entity is deleted after the template was created, the template does not break. Instead:

- Deleted custom field references are silently skipped when applying the template.
- Deleted group references are skipped, and the user is informed that some groups no longer exist.
- Deleted structure references are skipped, and the structure placement field is left blank.

Templates are validated on application, not on save. This avoids forcing users to update templates whenever they reorganize their system's fields or groups.

## Technical Considerations

### Data Model

Templates can be stored as encrypted JSON blobs rather than requiring a fully normalized table structure. Each template is a document with the following shape:

- `id`: Unique identifier
- `systemId`: Owning system
- `name`: Template name (encrypted)
- `description`: Optional description (encrypted)
- `defaults`: Object containing optional values for each template-supported field category (custom fields, groups, structure, tags, notifications)

The `defaults` object mirrors the member creation input type but with all fields optional. This keeps the template schema closely aligned with the member model without requiring migration when member fields change.

### Reference Validation

When a template is applied during member creation, each reference (field definition ID, group ID, structure entity ID) is validated against the current system state. Missing references are skipped with a user-facing note. This validation runs client-side against the local decrypted data.

### No Migration for Existing Members

Templates are a creation-time convenience. They do not affect existing members. There is no "re-apply template" action that would overwrite a member's current data with template values.

### Storage

Templates are relatively small documents (a few KB each, mostly IDs and simple values). Storing them as encrypted blobs in a `member_templates` table is straightforward. The table has columns for `id`, `systemId`, and `encryptedBlob`. All template content (name, description, defaults) lives inside the encrypted blob.

## Privacy and Encryption Implications

Templates are T1 encrypted. They contain the same categories of sensitive data as member profiles: names, descriptions, tags, and field values. The server stores only encrypted blobs and cannot see template names, descriptions, or any default values.

Templates are per-system and are never shared across systems. They do not participate in privacy bucket sharing. A template is accessible only to the system that created it.

The "save as template" feature reads from an existing member's decrypted data client-side and constructs a new encrypted template blob. No member data passes through the server in plaintext during this process.

Template sync between devices uses the same CRDT mechanism and encryption as other system-level entities.

## Open Questions

- Should templates support inheritance (a base template with overrides)? For example, a "Protector" base template and a "Protector - Subsystem A" template that inherits from it and adds a structure placement. Inheritance adds complexity but could reduce template duplication in large systems.
- Should there be a maximum number of templates per system? A practical limit (e.g., 50) would prevent server bloat, but it is unclear what limit is reasonable. Systems with many subsystems might legitimately need many templates.
- Should templates be exportable and importable between systems? This could help systems that split or re-form, but it introduces cross-system data transfer concerns and requires careful handling of ID remapping (field definition IDs in the source system will not match the target system).
- Should templates support conditional defaults (e.g., "if the member is tagged as a little, set notification preferences to restricted")? This adds expressiveness but significantly increases template complexity.
- How should the UI handle applying a template when the user has already partially filled in the creation form? Options include overwriting all fields, merging (only filling blank fields), or prompting the user to choose.
