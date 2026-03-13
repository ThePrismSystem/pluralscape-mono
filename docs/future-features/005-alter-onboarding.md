# Future Feature: New/Rediscovered Alter Onboarding

## Metadata

| Field                | Value                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Status               | proposed                                                                                                          |
| Category             | identity                                                                                                          |
| Estimated Complexity | medium                                                                                                            |
| Dependencies         | Member profiles (feature spec 1), member lifecycle events (feature spec 6), system chat (feature spec 3)          |
| Related Features     | 012-member-templates (template-based creation), custom fields (feature spec 1), system structure (feature spec 6) |

## Summary

A guided onboarding flow for when a new member is discovered or a dormant member returns to the system. The flow walks through setting up identity details step by step, creating appropriate lifecycle events automatically, and optionally announcing the member's arrival or return via system chat. Every step is skippable, and partial profiles are fully supported for members who don't yet know their own details.

## Motivation

Discovering a new member or having a dormant member return is a significant moment for a system. Currently, users would need to manually create a member profile, fill in fields one by one, assign group memberships, and separately log a lifecycle event. This is tedious during what is often an emotionally intense time. A guided flow reduces friction, ensures important setup steps aren't missed, and normalizes the experience of incomplete self-knowledge by making every field optional. It also ensures that lifecycle events (discovery, dormancy-end) are consistently recorded, which supports long-term system documentation and therapeutic reflection.

## User Stories

- As a system host, I want a guided flow when we discover a new member so that I can help them get set up without forgetting important steps like notification preferences or group assignments.
- As a newly discovered member, I want to be able to skip any step I'm not ready to answer so that I don't feel pressured to define myself before I'm ready.
- As a system member, I want the option to start a new member's profile from a template so that common configurations (like shared group memberships or default notification settings) are pre-filled.
- As a system, I want a lifecycle event automatically created when a new member is onboarded so that our system history stays accurate without manual bookkeeping.
- As a system member, I want the option to post a welcome message to system chat when a new member is onboarded so that everyone is informed and the new member feels acknowledged.

## Proposed Behavior

The onboarding flow is accessible from the member list via an "Add Member" action, with two entry points: "Start from scratch" and "Start from template" (if templates exist, see feature 012). A separate entry point exists for "Returning member" which pre-selects from archived/dormant members.

The flow presents the following steps in sequence, each independently skippable:

1. **Name and pronouns** -- basic identity. Supports "I don't know yet" as a valid state (unnamed member with placeholder).
2. **Description** -- rich text description with member linking support.
3. **Photos** -- avatar and gallery photo upload with built-in crop/resize.
4. **Custom fields** -- presents existing custom field definitions for the member to fill in.
5. **Groups and folders** -- select group memberships from existing groups.
6. **System structure** -- assign to subsystems, side systems, or layers.
7. **Notification preferences** -- per-member settings (suppress friend front notifications, auto-post board message on front).
8. **Welcome message** -- optional message posted to system chat, authored by the new member or by whoever is running the flow.

On completion (or skip-all), the flow:

- Creates the member profile with whatever data was provided.
- Automatically creates a "discovery" lifecycle event (for new members) or "dormancy-end" lifecycle event (for returning members), timestamped to the current moment (editable).
- Posts the welcome message to system chat if one was composed.
- Navigates to the new member's profile.

The flow shows a progress indicator but no "you must complete X before proceeding" gates. Users can exit at any point and the member is created with whatever was filled in so far.

When starting from a template, all template values are pre-filled but editable. The user can override any template value during onboarding.

## Technical Considerations

- The onboarding flow is a multi-step form wizard. State should be held in memory (not persisted) until the user completes or exits. On exit, prompt whether to save progress or discard.
- Template application is a data merge operation: template values become defaults, user values override.
- Lifecycle event creation should use the existing lifecycle event system (feature spec 6) -- the onboarding flow simply calls the same creation logic with the appropriate event type.
- System chat message posting should use the existing chat message API.
- The flow must work fully offline (all data stays local until sync).
- Consider mobile UX constraints: each step should be a separate screen/card, not a long scrollable form.
- For returning members, the flow should pre-populate from the archived member's existing data, allowing the returning member to update anything that has changed.

## Privacy and Encryption Implications

- All onboarding data (name, pronouns, description, photos, custom fields, group memberships, structure placements, notification preferences) is T1 encrypted (zero-knowledge). The server never sees any of this data.
- Template data used during onboarding is also T1 encrypted.
- The welcome message posted to system chat follows existing chat encryption (T1).
- The lifecycle event created is T1 encrypted.
- The entire onboarding flow runs client-side with no server involvement beyond normal sync operations. No server-side state tracks that an onboarding is in progress.

## Open Questions

- Should the onboarding flow steps be customizable per-system (reorder steps, hide steps, add custom steps)?
- Should there be a "quick add" mode that presents only name and pronouns for minimal-friction member creation?
- How should the onboarding flow be adapted for littles? A simplified interface with larger buttons, icons, and fewer steps would align with Littles Safe Mode principles, but the onboarding flow itself may be run by a non-little on behalf of a little.
- Should the flow support creating multiple members at once (e.g., when a subsystem is discovered with several members simultaneously)?
- How should the flow handle the case where the new member wants to run their own onboarding but the current fronter started it? Should there be a "hand off to new member" option?
