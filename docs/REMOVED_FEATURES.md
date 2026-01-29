# Removed Features

The following features have been removed during the architecture refactoring to simplify the codebase and focus on core note-taking functionality.

## Removed Features

### Daily Notes
Automatic journal entries with date-based organization.
- **Status**: Removed from core
- **Reason**: Adding complexity without being essential to the core note-taking experience
- **Future**: Will return as an optional plugin

### Tasks
Inline task management with checkboxes and due dates.
- **Status**: Removed
- **Reason**: Task management is no longer supported in the current architecture

### Meetings
Structured meeting notes with attendees and agendas.
- **Status**: Removed from core
- **Reason**: Specialized feature that added complexity
- **Future**: May return as an optional plugin

### People
Contact/person management with mentions.
- **Status**: Removed from core
- **Reason**: Specialized feature better suited for a plugin
- **Future**: May return as an optional plugin

### CLI Installer
Command-line installer for setting up Scribe.
- **Status**: Removed
- **Reason**: Simplified installation process; use standard package manager

### Raycast Extension
Raycast integration for quick note access.
- **Status**: Removed
- **Reason**: Maintenance burden; not core to the product
- **Future**: May return as a community extension

### Cloud Sync
Real-time sync across devices via cloud storage.
- **Status**: Removed from MVP
- **Reason**: Complex feature requiring significant infrastructure
- **Future**: Planned for future release with proper encryption

## Why Removed?

These features were removed for several reasons:

1. **Complexity Reduction**: Each feature added maintenance burden and code complexity. Removing them allows faster iteration on core functionality.

2. **Plugin Architecture**: Many features are better implemented as optional plugins. This keeps the core lightweight while allowing users to add features they need.

3. **Focus**: The refactoring focused on establishing a solid daemon-centric architecture. Once that foundation is stable, features can be added back properly.

4. **Code Quality**: Some features had accumulated technical debt. Rather than carrying that forward, it's cleaner to remove and re-implement properly.

## Migration Guide

### Daily Notes
Until the plugin is available:
- Create regular notes with date titles
- Use tags for organization (e.g., `#journal`, `#daily`)

### Meetings
Until the plugin is available:
- Use regular notes with a meeting template
- Add attendee mentions manually

## Feature Requests

If you need a removed feature, you can:

1. **Build a Plugin**: See [plugin-core](../packages/plugin-core/README.md) for the plugin framework
2. **Open an Issue**: Request the feature at [github.com/erikjohansson/scribe/issues](https://github.com/erikjohansson/scribe/issues)
3. **Contribute**: Submit a PR to add the feature back (as a plugin preferred)
