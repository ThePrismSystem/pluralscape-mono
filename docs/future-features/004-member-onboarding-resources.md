# Future Feature: Member Onboarding Resources

## Metadata

| Field                | Value                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Status               | proposed                                                                                                  |
| Category             | identity                                                                                                  |
| Estimated Complexity | medium                                                                                                    |
| Dependencies         | Member profiles (feature spec 1), system structure (feature spec 6), system chat (feature spec 3)         |
| Related Features     | 011-member-templates (template-based creation), custom fields (feature spec 1), wiki pages (feature spec) |

## Summary

A configurable "Welcome to the System" resources page that serves as an onboarding reference for members who need to be brought up to speed on the system's collective external life and internal dynamics. This is a living document maintained by the system that any member can access -- particularly valuable for newly discovered members, members returning from dormancy, or members who are unfamiliar with the system's current situation.

## Motivation

When a new member is discovered or a dormant member returns, they often need to understand a significant amount of context: who else is in the system, how the body's daily life works (job, relationships, routines), what the system's internal agreements and rules are, who handles what responsibilities, and how to navigate shared external relationships. Currently, this information lives in the heads of established members or is scattered across journal entries and chat history.

A dedicated, curated resources page provides a single place where the system can document everything a member needs to know. This reduces the burden on established members who would otherwise need to repeatedly explain things, and gives the new or returning member agency to learn at their own pace without feeling like a burden.

## Proposed Behavior

### Resources Page Structure

The onboarding resources page is a system-level document (one per system) accessible from the member list or system settings. It is organized into configurable sections, each containing rich text content with support for member links, structure references, and embedded media. Default sections (all optional, customizable):

1. **Welcome message** -- a general introduction to the system, written by the system for new members.
2. **External life overview** -- information about the body's daily life: job/school, living situation, important external relationships, daily routines, and responsibilities.
3. **System agreements** -- internal rules, communication norms, fronting etiquette, and boundaries the system has agreed on.
4. **System structure overview** -- an overview of the system's organizational structure (subsystems, layers, side systems) and how they relate to each other, with links to the relevant structure entities.
5. **Key contacts** -- members who are designated points of contact for questions, emergencies, or specific topics (e.g., "talk to [protector] about safety concerns, [host] about work questions").
6. **Important information** -- critical practical information: medications, allergies, emergency contacts, therapist details, and anything else a fronting member needs to know to safely navigate the body's life.
7. **FAQ** -- common questions new members ask, with answers.

### Editing and Maintenance

Any member can edit the resources page (subject to system-level permission settings if configured). Changes are versioned through the standard CRDT sync mechanism. The page supports collaborative editing -- multiple members can contribute their own sections or perspectives.

### Access

The resources page is always accessible from a prominent location in the app (member list, sidebar, or system settings). A system setting controls whether the resources page is shown as a prompt when a new member profile is created (a non-intrusive notification: "Would you like to view the system's onboarding resources?").

### Littles Safe Mode

In Littles Safe Mode, the resources page renders with the simplified UI (larger text, simpler layout). Systems can configure a separate "littles version" of the resources page with age-appropriate content and simpler language.

## Technical Considerations

- The resources page is a single encrypted document per system, stored as a rich text blob (reusing the existing block-based rich text format from wiki pages and journal entries).
- Section structure is encoded within the document content, not as separate database rows. This keeps the data model simple and allows flexible section ordering and customization.
- Member links and structure references within the document are resolved client-side against the current system state. If a referenced member is archived or a structure entity is deleted, the link renders as a placeholder with a note.
- The page is synced between devices via the standard CRDT mechanism.
- Consider capping document size to prevent unbounded growth (e.g., 500KB encrypted blob limit, matching wiki pages).

## Privacy and Encryption Implications

- The entire resources page is T1 encrypted (zero-knowledge). The server stores only an encrypted blob and cannot see any content, section titles, or member references.
- The page is per-system and is never shared externally. It does not participate in privacy bucket sharing. It is accessible only to members of the system.
- If the system uses the resources page to document sensitive information (medications, trauma-related agreements, emergency procedures), this data is protected by the same encryption as all other T1 content.

## Open Questions

- Should the resources page support per-section access controls (e.g., some sections visible only to certain members or structure groups)? This adds complexity but could be useful for sensitive information that not all members should see (e.g., trauma-related content that littles should not access).
- Should there be a "read receipt" mechanism so the system can track which members have viewed the resources page? This could help identify members who might need additional support, but it could also feel surveillance-like.
- Should the resources page be printable or exportable for offline reference? This would leave the encrypted environment, so the same warnings as therapist report export would apply.
- How should the resources page interact with Littles Safe Mode? Should there be a completely separate littles version, or should sections be tagged as "littles-safe" vs "full version"?
- Should sections be reorderable per-member (each member sees the page in their preferred order) or is a single system-wide ordering sufficient?
