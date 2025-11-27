# Scribe Design System — Usage Guidelines for Agents & Feature Authors

This document defines **how engineers, agents, and future contributors should use the Scribe Design System** when implementing frontend features. It codifies the rules, constraints, and expectations that ensure consistency, maintainability, and visual cohesion across the Scribe application.

These guidelines apply to any UI work—command palette extensions, new panels, dialogs, editor chrome, or future mobile interfaces.

---

# 1. Core Principles

All contributors must follow these non-negotiable principles:

## **1.1 Token-First Design**

All visual styling **must** be driven by design tokens.

- No raw hex colors
- No ad hoc spacing values
- No arbitrary radii or shadows
- No custom z-index values

**Correct:**

```ts
color: vars.color.foreground;
padding: vars.spacing[3];
borderRadius: vars.radius.md;
```

**Incorrect:**

```ts
color: '#333';
padding: '10px';
borderRadius: '6px';
```

Tokens represent visual intent. Always use them.

---

## **1.2 Composition Over Configuration**

Use primitives to build UI. Do **not** create overly complex, rigid components.

Examples:

- Use `Surface` + `Text` + `Button` to create a header—not a separate `Header` component.
- Use `List` + `ListItem` for command results—not a new custom list implementation.

This keeps the design system:

- Flexible
- Predictable
- Consistent

---

## **1.3 Minimalism by Default**

All UI in Scribe should feel:

- Clean
- Quiet
- Uncluttered
- Writing-focused

Avoid:

- Heavy borders
- Loud colors
- Overly complex layouts
- Novel UI patterns

Scribe prioritizes mental clarity for the user.

---

## **1.4 Semantic Meaning Over Visual Styling**

Use **semantic variants** rather than trying to recreate specific visual looks.

Correct:

- Use `variant="surface"` when a container is meant to be interactive or layered.
- Use `variant="backgroundAlt"` for subtle sectioning.
- Use `tone="accent"` for primary actions.

Avoid building unique undocumented variants.

---

## **1.5 Consistent Elevation Rules**

Shadows (`elevation`) communicate layer hierarchy.

Rules:

- `elevation="none"`: default for surfaces inside a view
- `elevation="sm"`: hover or small popovers
- `elevation="md"`: command palette, contextual surfaces
- `elevation="lg"`: modal dialogs, high-level overlays

Never invent custom shadows.

---

# 2. Component Usage Rules

Below are direct guidelines for each primitive.

---

## 2.1 Surface

- The base container for most UI elements
- Must use a semantic `variant`: `surface | background | backgroundAlt`
- Do not use raw `<div>` with custom background colors
- Borders should come from token-driven `bordered`, not CSS overrides

---

## 2.2 Text

- Use `Text` for all textual content—never plain `<p>` or `<span>` with custom styles
- Typography size must come from the size token (`sm`, `md`, etc.)
- Use `mono` only for code, hotkeys, or technical identifiers

Examples:

- Labels: `size="sm"`
- Body text: `size="md"`
- Section headers: `weight="medium"`

---

## 2.3 Button

- Use semantic variants: `solid`, `ghost`, `subtle`
- `solid` + `tone="accent"` is the _only_ primary action style
- Never manually color a button
- Icons should use the `Icon` wrapper for alignment

Correct:

```tsx
<Button variant="solid" tone="accent">
  Save
</Button>
```

Incorrect:

```tsx
<button style={{ background: 'gold' }}>Save</button>
```

---

## 2.4 Input

- Use only the `Input` primitive for searchable or editable fields
- Cannot create custom chrome or decorated input fields
- Must use token-driven focus styles

Correct:

```tsx
<Input placeholder="Search" />
```

---

## 2.5 List & ListItem

- Use lists for:
  - Command palette results
  - Search suggestions
  - Any vertical selectable menu
- Selection must use `accent` tokens
- Highlight + keyboard support is required for interactive lists

---

## 2.6 Icon

- Wrap all icons in the `Icon` primitive
- Never hardcode icon sizes
- Use semantic sizes for consistency

Correct:

```tsx
<Icon size="sm">
  <SearchIcon />
</Icon>
```

---

## 2.7 Overlay & Portal

- Required for command palette, dialogs, and floating UI
- Always use semantic `zIndex`: `palette`, `modal`, `popover`, etc.
- Do not manually style backdrop opacity outside of provided props

---

# 3. Theming Rules

## 3.1 Theme Switching

- Light/dark themes are controlled at the app entry root
- Never toggle colors inside components
- Use `vars.color.*` instead of referencing `light` or `dark` directly

## 3.2 No Mode-Specific Code

Incorrect:

```tsx
color: isDarkMode ? '#fff' : '#333';
```

Correct:

```tsx
color: vars.color.foreground;
```

## 3.3 Token Extensions

If new tokens are needed:

- Extend the token contract in `/tokens/contract.css.ts`
- Provide values in both light and dark themes
- Update documentation before using the new token

---

# 4. Layout & Spacing Rules

## 4.1 Use Spacing Tokens Exclusively

Every margin, padding, gap, inset must come from:

```
vars.spacing[0 | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 24]
```

## 4.2 Consistent Padding Defaults

Application-wide default padding:

- Internal padding in most surfaces: `vars.spacing[3]` or `vars.spacing[4]`
- Large modals or palette bodies: `vars.spacing[6]`
- Small touch targets: `vars.spacing[2]`

## 4.3 Flex & Grid Usage

- Layout is not part of the design system
- Use browser-native flex/grid
- Do not create layout wrappers (e.g., `Row`, `Column`, `Stack`)

---

# 5. Accessibility & Keyboard Rules

## 5.1 Focus Styles

- All interactive elements must show a visible focus ring
- Focus ring must use the `accent` token

## 5.2 Keyboard Navigation

Interactive components must:

- Support arrow-key navigation when inside a list
- Support Enter/Space activation
- Support Escape dismissal if applicable

## 5.3 ARIA

- Provide `aria-label` for icon-only buttons
- Label interactive list items properly
- Use semantic roles: `listbox`, `option`, `dialog`, `textbox`, etc.

---

# 6. Visual Consistency Rules

## 6.1 Radii

Use only the following radii:

```
none, sm, md, lg, full
```

Never use custom border-radius values.

## 6.2 Shadows

Only use:

```
sm, md, lg
```

Avoid adding new shadows unless part of DS evolution.

## 6.3 Color Hierarchy

The accent is for:

- Primary actions
- Highlights
- Keyboard focus
- Selected states

It should **not** be used for decoration or ornamental elements.

---

# 7. Do's and Don'ts

### Do:

- Use primitives for all UI
- Follow token-first styling
- Keep UI quiet and minimal
- Prefer composition over new component creation
- Use semantic naming and variants

### Don't:

- Hardcode colors or spacing
- Create custom components without DS alignment
- Introduce layout wrappers with custom rules
- Overuse accent color
- Break minimalism with heavy chrome

---

# 8. When to Introduce New Components

You may propose new components only when:

- Multiple features require it
- It cannot be composed from primitives
- It aligns with Scribe’s design philosophy
- It uses tokens exclusively
- It is documented before usage

Examples of acceptable future additions:

- Dialog
- Popover
- Tabs
- Tag/Badge
- Toolbar for the editor

Examples of unacceptable additions:

- A highly custom animated widget
- A new layout primitive
- A component with bespoke color rules

---

# 9. Summary

These guidelines ensure that all UI built for Scribe:

- Uses tokens correctly
- Remains aligned with Scribe’s minimal, editorial aesthetic
- Stays maintainable and predictable
- Works seamlessly across light/dark themes
- Remains consistent no matter who implements the feature

This document should be referenced before writing any frontend code.
