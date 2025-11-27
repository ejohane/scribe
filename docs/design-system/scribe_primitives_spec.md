# Scribe Design System — Primitive Components Specification

This document defines the **minimal primitive components** that form the foundation of the Scribe Design System. These primitives are intentionally lightweight, token-driven, and platform-aware. They provide the essential building blocks for the Scribe UI—starting with the command palette and expanding naturally as the product grows.

---

# 1. Overview

Scribe’s UI is intentionally minimal and focused. To support this, the design system defines a small set of primitives that:

- Enforce visual consistency through typed design tokens
- Support both light and dark themes
- Work for desktop (React) today and mobile (React Native) in the future
- Are composable rather than prescriptive
- Map directly onto semantic roles, not abstract UI patterns

These primitives are the **lowest-level UI building blocks** from which all components and patterns (command palette, toolbars, dialogs, etc.) are composed.

---

# 2. Primitive Component List

The following primitives are included in the initial version of the design system:

1. **Surface**
2. **Text**
3. **Button**
4. **Input**
5. **List / ListItem**
6. **Icon** wrapper
7. **Overlay / Portal**

Each primitive has a clear purpose, a defined API surface, and usage guidelines.

---

# 3. Surface

A `Surface` is a foundational container element. It defines visual context, contrast, elevation, and semantic meaning.

## Purpose

- Provides a consistent container for UI elements
- Maps directly to semantic color tokens (`surface`, `background`, `backgroundAlt`)
- Establishes elevation via shadows
- Forms the structural foundation for panels, modals, palette containers, etc.

## Props

- `variant`: `"surface" | "background" | "backgroundAlt"` (default: `"surface"`)
- `elevation`: `"none" | "sm" | "md" | "lg"`
- `padding`: uses `spacing` tokens
- `radius`: `"sm" | "md" | "lg" | "none" | "full"`
- `bordered`: `boolean` — applies token-based border

## Behavior

- No layout assumptions (no flex/grid behavior)
- Can be nested
- Inherit radius and elevation from design tokens

## Usage Example

```tsx
<Surface elevation="md" padding={4}>
  <Text size="md">Hello</Text>
</Surface>
```

---

# 4. Text

Low-level text primitive used everywhere—including list items, palette results, buttons, labels, and content.

## Purpose

- Ensure consistent typography (size, weight, line height, color)
- Provide a flexible, non-opinionated text element
- Support monospace for editor-related UI

## Props

- `size`: `"xs" | "sm" | "md" | "lg" | "xl"`
- `weight`: `"regular" | "medium" | "bold"`
- `mono`: `boolean` — switches to `mono` font family
- `color`: optional semantic override using token values

## Behavior

- No margin or padding by default
- Inherits color from the surrounding context unless specified

## Usage Example

```tsx
<Text size="sm">Search Results</Text>
<Text mono size="sm">⌘ K</Text>
```

---

# 5. Button

Minimal, semantic, token-driven button used for actions within Scribe.

## Purpose

- Execute actions (e.g., run command, confirm operation)
- Provide consistent focus, hover, and active behavior
- Support optional icons

## Variants

- `solid` — filled, accent-driven
- `ghost` — low-emphasis text button
- `subtle` — minimal background-based button for palette or list interactions

## Props

- `variant`: `"solid" | "ghost" | "subtle"`
- `tone`: `"accent" | "neutral"`
- `size`: `"sm" | "md"`
- `iconLeft`: ReactNode
- `iconRight`: ReactNode
- `disabled`: boolean

## Behavior

- Keyboard-focus visible
- Uses semantic tokens for colors
- Respects radius and spacing tokens

## Usage Example

```tsx
<Button variant="solid" tone="accent">Run</Button>
<Button variant="ghost" iconLeft={<IconSearch />}>Search</Button>
```

---

# 6. Input

A minimalist input field used for command palette search and any filtering functionality.

## Purpose

- Provide a clean, token-consistent input
- Work inside the command palette and other UI shells
- Support optional prefix icon

## Props

- `iconLeft`: ReactNode
- `value`: string
- `onChange`: (value: string) => void
- `placeholder`: string
- `size`: `"sm" | "md"`

## Behavior

- Uses surface + border tokens
- Rounded corners (medium radius)
- Subtle focus ring using `accent` token

## Usage Example

```tsx
<Input placeholder="Search..." iconLeft={<IconSearch />} />
```

---

# 7. List & ListItem

The foundation for command palette results, sidebar lists (future), and selection UIs.

## Purpose

- Provide a structured, keyboard-navigable list
- Support icons and metadata
- Support focus + selected states using accent tokens

## List Props

- None (structural component)

## ListItem Props

- `selected`: boolean
- `iconLeft`: ReactNode
- `iconRight`: ReactNode
- `disabled`: boolean

## Behavior

- Selected state uses `accent` + `surface` tokens
- Hover uses `backgroundAlt` token
- Supports arrow key navigation
- No layout assumptions—flex row by default

## Example

```tsx
<List>
  <ListItem selected iconLeft={<IconFile />}>
    Open File
  </ListItem>
</List>
```

---

# 8. Icon

A simple wrapper to normalize the sizing and alignment of icons across the UI.

## Purpose

- Provide consistent icon sizing
- Avoid per-icon CSS overrides
- Smooth scaling across different DPI levels

## Props

- `size`: `"xs" | "sm" | "md" | "lg"`
- Children: SVG or icon component

## Example

```tsx
<Icon size="sm">
  <SearchIcon />
</Icon>
```

---

# 9. Overlay & Portal

Used for command palette, dialogs, menus, and any UI elements that require layering.

## Purpose

- Provide semantic layering using `zIndex` tokens
- Apply a backdrop when needed
- Position floating surfaces (palette, dialogs)

## Overlay Props

- `backdrop`: `"none" | "transparent" | "blur"`
- Children: ReactNode

## Behavior

- Uses `zIndex.palette` or `zIndex.modal`
- No visual styling except optional backdrop
- Centers or positions children depending on composition

## Example

```tsx
<Overlay backdrop="transparent">
  <Surface elevation="lg">Palette content</Surface>
</Overlay>
```

---

# 10. Philosophy & Usage Principles

These primitives follow a few key principles:

### **Token-First**

All visual styling comes from the design token system.

### **Composition over Configuration**

Primitives provide the smallest useful building blocks—not full patterns.

### **Platform-Aware**

- Web uses vanilla-extract + CSS variables
- React Native will consume raw token values

### **Minimalism**

No margin by default, no layout assumptions, no unnecessary variants.

### **Keyboard & Accessibility First**

Consistent focus rings, ARIA props, and navigation patterns are expected.

---

# 11. Summary

This set of primitives forms the foundation for Scribe’s design system. These building blocks:

- Create uniformity across all UI surfaces
- Support current (desktop) and future (mobile) platforms
- Keep complexity low and control high
- Serve as the backbone for the command palette and future UI elements

Further layers (patterns, components, editor-specific elements) will build on top of these primitives.
