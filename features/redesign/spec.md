# Scribe UI Redesign

## Overview

This feature covers the redesign of the Scribe desktop application UI to match the visual design and UX patterns established in the POC (proof of concept) prototype.

## Goal

Transform the current minimal editor-focused UI into a full-featured note-taking application with:
- Three-panel layout (sidebar, editor, context panel)
- Modern, clean visual aesthetic
- Improved navigation and discoverability
- Consistent design language

## Reference Implementation

The POC prototype is located at:
```
redesign-poc/
├── App.tsx                      # Main app with layout and state
├── components/
│   ├── Sidebar.tsx              # Left panel - note list
│   ├── RightPanel.tsx           # Right panel - context/backlinks
│   ├── CommandPalette.tsx       # Search/create modal
│   └── Editor/
│       ├── Editor.tsx           # ContentEditable editor
│       ├── FloatingMenu.tsx     # Slash/mention/link menus
│       └── SelectionMenu.tsx    # Text selection toolbar
├── types.ts                     # Type definitions
└── index.html                   # Tailwind config and base styles
```

**Note:** The POC uses Tailwind CSS via CDN for rapid prototyping. The production implementation will use our existing vanilla-extract design system with updated tokens.

## Current Implementation

The desktop app is located at:
```
apps/desktop/renderer/src/
├── App.tsx                      # Current app entry
├── components/
│   ├── CommandPalette/          # Existing command palette (preserve functionality)
│   ├── Editor/
│   │   ├── EditorRoot.tsx       # Lexical-based editor (keep)
│   │   └── plugins/             # WikiLink, PersonMention, etc. (keep)
│   ├── BackButton/              # Wiki-link navigation (keep)
│   ├── Toast/                   # Notifications (keep)
│   └── ErrorNotification/       # Error display (keep)
└── hooks/                       # Note state, navigation, etc. (keep)
```

## Design System

The redesign includes updating the design system color palette from warm amber/cream tones to a cooler, neutral palette:

- **Color palette spec:** `features/redesign/color-palette.md`
- **Design system package:** `packages/design-system/`
- **Design system spec:** `features/design-system/spec.md`

## Approach

1. **Preserve functionality** - All existing features (command palette modes, wiki-links, person mentions, backlinks, etc.) must continue to work
2. **Update styling** - Migrate visual design to match POC using design system tokens
3. **Add new components** - Sidebar, floating dock, context panel, selection toolbar, slash menu
4. **Incremental delivery** - Each feature can be merged independently

## Feature Breakdown

See `features/redesign/feature-breakdown.md` for the complete list of 11 features:

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| 1 | Color Palette Update | P0 | Update design tokens to cool neutral palette |
| 2 | App Shell Layout | P0 | Three-panel layout foundation |
| 3 | Sidebar | P1 | Left panel with note list |
| 4 | Floating Dock | P1 | Bottom toolbar with quick actions |
| 5 | Context Panel | P2 | Right panel with backlinks, tasks, calendar |
| 6 | Command Palette Redesign | P1 | Visual refresh of existing component |
| 7 | Editor Title Input | P1 | Large title above editor content |
| 8 | Selection Toolbar | P2 | Floating formatting menu on text selection |
| 9 | Slash Command Menu | P2 | "/" triggered block commands |
| 10 | Mention Autocomplete | P3 | Restyle existing @ autocomplete |
| 11 | Note Link Autocomplete | P3 | Restyle existing [[ autocomplete |

## Screenshots

The POC demonstrates:
- Clean white/gray neutral palette
- Collapsible left sidebar with note list
- Floating action dock at bottom center
- Command palette with search and create
- Right context panel with backlinks and widgets
- Dark mode support

## Out of Scope

- Calendar integration (placeholder only)
- Task extraction from notes (placeholder only)
- User accounts (placeholder only)
- AI features (requires backend)
- Mobile/responsive design (desktop Electron focus)

## Related Documents

- `features/redesign/color-palette.md` - Color token specifications
- `features/redesign/animations.md` - Animation and transition specifications
- `features/redesign/feature-breakdown.md` - Detailed feature specs
- `features/design-system/spec.md` - Design system architecture
- `docs/design-system/` - Design system documentation
