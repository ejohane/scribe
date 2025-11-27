# Scribe Design System Specification

This specification consolidates the complete design system for Scribe, defining the visual language, token architecture, primitive components, and usage guidelines that ensure consistency across the application.

---

## 1. Overview

### 1.1 Product Context

Scribe is a writing-focused application with the following characteristics:

- **Primary platform**: Desktop React/Electron app
- **Future platform**: React Native mobile app (sharing foundations)
- **Development model**: Single-designer/engineer environment prioritizing speed, flexibility, and craftsmanship

### 1.2 Design Philosophy

The design system follows a hybrid aesthetic blending:

- **Minimalist neutral** (inspired by Obsidian, Raycast, Linear)
- **Warm editorial softness** (inspired by Notion, Medium)

Key characteristics:

- Warm, clean neutrals
- Subtle editorial tone
- Minimal elevation
- Crisp typography
- Keyboard-first, writing-focused interactions
- Modern, calm, premium, and distraction-free feel

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. **Establish a consistent visual language**
   - Warm neutral base
   - Editorial minimalism
   - Calm, distraction-free writing environment

2. **Stay lightweight and highly maintainable**
   - No heavy theme engines
   - No external design tokens pipeline
   - No enterprise abstractions

3. **Use a token-first, type-safe foundation**
   - Powered by vanilla-extract
   - Strong TypeScript types for all tokens
   - CSS variables for web, raw objects for mobile

4. **Provide a minimal set of primitives**
   - Surface, Text, Button, Input, List/ListItem, Icon, Overlay
   - Enough to build the command palette and expand incrementally

5. **Support light/dark themes**
   - Clean, low-friction theme switching
   - Semantic color tokens

6. **Stay aligned with the writing-focused nature of Scribe**
   - Elegant typography
   - Comfortable color palette
   - Minimal chrome
   - Keyboard-first UX

### 2.2 Non-Goals

- Serve as a public UI library
- Include a large catalog of components (tabs, forms, etc.)
- Add Tailwind or utility-class dependencies
- Introduce complex Figma/token syncing workflows
- Support user-generated themes (for v1)

---

## 3. Token Architecture

### 3.1 Token Philosophy

The Scribe token system is:

- **Semantic first** (`foreground.primary` > `gray.900`)
- **Platform-agnostic**
- **Type-safe** via a vanilla-extract contract
- **Lightweight** with minimal categories
- **Expandable** without breaking changes

Tokens are the single source of truth for the system's visuals.

### 3.2 Token Categories

#### Colors

Neutral tokens (warm-leaning) with semantic mapping:

| Token              | Purpose                            |
| ------------------ | ---------------------------------- |
| `background`       | Main app background                |
| `backgroundAlt`    | Subtle sectioning/alternate areas  |
| `surface`          | Interactive/layered containers     |
| `border`           | Borders and dividers               |
| `foreground`       | Primary text color                 |
| `foregroundMuted`  | Secondary/muted text               |
| `accent`           | Primary actions, highlights, focus |
| `accentForeground` | Text on accent backgrounds         |
| `danger`           | Error states                       |
| `warning`          | Warning states                     |
| `info`             | Informational states               |

#### Typography

| Category     | Values                       |
| ------------ | ---------------------------- |
| Font family  | `ui`, `mono`                 |
| Font sizes   | `xs`, `sm`, `md`, `lg`, `xl` |
| Font weights | `regular`, `medium`, `bold`  |
| Line heights | `tight`, `normal`, `relaxed` |

#### Spacing

Scale: `0`, `1`, `2`, `3`, `4`, `6`, `8`, `12`, `16`, `24`

#### Radii

`none`, `sm`, `md`, `lg`, `full`

#### Shadows

`sm`, `md`, `lg`

#### Z-Index

`base`, `overlay`, `modal`, `palette`, `popover`, `tooltip`

### 3.3 Theme Contract Structure

```typescript
// Color Contract
color: {
  background;
  backgroundAlt;
  surface;
  border;
  foreground;
  foregroundMuted;
  accent;
  accentForeground;
  danger;
  warning;
  info;
}

// Typography Contract
typography: {
  fontFamily: {
    (ui, mono);
  }
  size: {
    (xs, sm, md, lg, xl);
  }
  weight: {
    (regular, medium, bold);
  }
  lineHeight: {
    (tight, normal, relaxed);
  }
}

// Spacing Contract
spacing: {
  (0, 1, 2, 3, 4, 6, 8, 12, 16, 24);
}

// Radius Contract
radius: {
  (none, sm, md, lg, full);
}

// Shadow Contract
shadow: {
  (sm, md, lg);
}

// Z-Index Contract
zIndex: {
  (base, overlay, modal, palette, popover, tooltip);
}
```

---

## 4. Theme Values

### 4.1 Accent Color

**Warm Amber / Gold (Balanced Tone)**

- Not too bright or neon
- Not too muted or earthy
- Works beautifully across light and dark themes
- Provides a premium, crafted editorial feel
- Distinctive but subtle highlight color for commands, selections, primary actions

### 4.2 Light Theme Colors

| Token              | Value     |
| ------------------ | --------- |
| `background`       | `#FAF9F7` |
| `backgroundAlt`    | `#F4F1EC` |
| `surface`          | `#EAE6DF` |
| `border`           | `#D8D3CB` |
| `foreground`       | `#1E1C19` |
| `foregroundMuted`  | `#7A756B` |
| `accent`           | `#D9A441` |
| `accentForeground` | `#1E1C19` |
| `danger`           | `#B94A48` |
| `warning`          | `#E2A65C` |
| `info`             | `#50698C` |

### 4.3 Dark Theme Colors

| Token              | Value     |
| ------------------ | --------- |
| `background`       | `#1A1A18` |
| `backgroundAlt`    | `#23231F` |
| `surface`          | `#2C2B27` |
| `border`           | `#3A3935` |
| `foreground`       | `#F5F3EE` |
| `foregroundMuted`  | `#A7A398` |
| `accent`           | `#C2933A` |
| `accentForeground` | `#1A1A18` |
| `danger`           | `#D06968` |
| `warning`          | `#D19C5F` |
| `info`             | `#6C85A8` |

---

## 5. Primitive Components

### 5.1 Component List

1. **Surface** - Container element
2. **Text** - Typography primitive
3. **Button** - Action trigger
4. **Input** - Text input field
5. **List / ListItem** - Selection lists
6. **Icon** - Icon wrapper
7. **Overlay / Portal** - Layering system

### 5.2 Surface

A foundational container element defining visual context, contrast, elevation, and semantic meaning.

**Props:**

| Prop        | Type                                           | Default     |
| ----------- | ---------------------------------------------- | ----------- |
| `variant`   | `"surface" \| "background" \| "backgroundAlt"` | `"surface"` |
| `elevation` | `"none" \| "sm" \| "md" \| "lg"`               | `"none"`    |
| `padding`   | Spacing token                                  | -           |
| `radius`    | `"none" \| "sm" \| "md" \| "lg" \| "full"`     | -           |
| `bordered`  | `boolean`                                      | `false`     |

**Usage:**

```tsx
<Surface elevation="md" padding={4}>
  <Text size="md">Hello</Text>
</Surface>
```

### 5.3 Text

Low-level text primitive for consistent typography.

**Props:**

| Prop     | Type                                   | Default     |
| -------- | -------------------------------------- | ----------- |
| `size`   | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | `"md"`      |
| `weight` | `"regular" \| "medium" \| "bold"`      | `"regular"` |
| `mono`   | `boolean`                              | `false`     |
| `color`  | Semantic color token                   | inherited   |

**Usage:**

```tsx
<Text size="sm">Search Results</Text>
<Text mono size="sm">Cmd+K</Text>
```

### 5.4 Button

Minimal, semantic, token-driven button for actions.

**Variants:**

- `solid` - Filled, accent-driven
- `ghost` - Low-emphasis text button
- `subtle` - Minimal background-based button

**Props:**

| Prop        | Type                             | Default     |
| ----------- | -------------------------------- | ----------- |
| `variant`   | `"solid" \| "ghost" \| "subtle"` | `"solid"`   |
| `tone`      | `"accent" \| "neutral"`          | `"neutral"` |
| `size`      | `"sm" \| "md"`                   | `"md"`      |
| `iconLeft`  | `ReactNode`                      | -           |
| `iconRight` | `ReactNode`                      | -           |
| `disabled`  | `boolean`                        | `false`     |

**Usage:**

```tsx
<Button variant="solid" tone="accent">Run</Button>
<Button variant="ghost" iconLeft={<IconSearch />}>Search</Button>
```

### 5.5 Input

Minimalist input field for search and filtering.

**Props:**

| Prop          | Type                      | Default |
| ------------- | ------------------------- | ------- |
| `iconLeft`    | `ReactNode`               | -       |
| `value`       | `string`                  | -       |
| `onChange`    | `(value: string) => void` | -       |
| `placeholder` | `string`                  | -       |
| `size`        | `"sm" \| "md"`            | `"md"`  |

**Usage:**

```tsx
<Input placeholder="Search..." iconLeft={<IconSearch />} />
```

### 5.6 List & ListItem

Foundation for command palette results and selection UIs.

**List Props:** Structural component (no props)

**ListItem Props:**

| Prop        | Type        | Default |
| ----------- | ----------- | ------- |
| `selected`  | `boolean`   | `false` |
| `iconLeft`  | `ReactNode` | -       |
| `iconRight` | `ReactNode` | -       |
| `disabled`  | `boolean`   | `false` |

**Usage:**

```tsx
<List>
  <ListItem selected iconLeft={<IconFile />}>
    Open File
  </ListItem>
  <ListItem iconLeft={<IconSearch />}>Search Notes</ListItem>
</List>
```

### 5.7 Icon

Wrapper for consistent icon sizing and alignment.

**Props:**

| Prop   | Type                           | Default |
| ------ | ------------------------------ | ------- |
| `size` | `"xs" \| "sm" \| "md" \| "lg"` | `"md"`  |

**Usage:**

```tsx
<Icon size="sm">
  <SearchIcon />
</Icon>
```

### 5.8 Overlay & Portal

Layering system for command palette, dialogs, and floating UI.

**Overlay Props:**

| Prop       | Type                                | Default  |
| ---------- | ----------------------------------- | -------- |
| `backdrop` | `"none" \| "transparent" \| "blur"` | `"none"` |

**Usage:**

```tsx
<Overlay backdrop="transparent">
  <Surface elevation="lg">Palette content</Surface>
</Overlay>
```

---

## 6. Usage Guidelines

### 6.1 Core Principles

#### Token-First Design

All visual styling **must** be driven by design tokens.

```tsx
// Correct
color: vars.color.foreground;
padding: vars.spacing[3];
borderRadius: vars.radius.md;

// Incorrect
color: '#333';
padding: '10px';
borderRadius: '6px';
```

#### Composition Over Configuration

Use primitives to build UI. Do not create overly complex, rigid components.

- Use `Surface` + `Text` + `Button` to create a header
- Use `List` + `ListItem` for command results

#### Minimalism by Default

All UI should feel clean, quiet, uncluttered, and writing-focused. Avoid:

- Heavy borders
- Loud colors
- Overly complex layouts
- Novel UI patterns

#### Semantic Meaning Over Visual Styling

Use semantic variants rather than recreating specific visual looks:

- `variant="surface"` for interactive/layered containers
- `variant="backgroundAlt"` for subtle sectioning
- `tone="accent"` for primary actions

### 6.2 Elevation Rules

| Elevation | Usage                                |
| --------- | ------------------------------------ |
| `none`    | Default for surfaces inside a view   |
| `sm`      | Hover states, small popovers         |
| `md`      | Command palette, contextual surfaces |
| `lg`      | Modal dialogs, high-level overlays   |

### 6.3 Theming Rules

- Light/dark themes are controlled at the app entry root
- Never toggle colors inside components
- Use `vars.color.*` instead of referencing light/dark directly

```tsx
// Incorrect
color: isDarkMode ? '#fff' : '#333';

// Correct
color: vars.color.foreground;
```

#### Token Extensions

If new tokens are needed:

1. Extend the token contract in `/tokens/contract.css.ts`
2. Provide values in both light and dark themes
3. Update documentation before using the new token

### 6.4 Layout & Spacing Rules

**Use Spacing Tokens Exclusively:**

```
vars.spacing[0 | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 24]
```

**Consistent Padding Defaults:**

| Context                     | Spacing             |
| --------------------------- | ------------------- |
| Internal surface padding    | `vars.spacing[3-4]` |
| Large modals/palette bodies | `vars.spacing[6]`   |
| Small touch targets         | `vars.spacing[2]`   |

**Layout:**

- Use browser-native flex/grid
- Do not create layout wrappers (`Row`, `Column`, `Stack`)

### 6.5 Accessibility & Keyboard Rules

#### Focus Styles

- All interactive elements must show a visible focus ring
- Focus ring must use the `accent` token

#### Keyboard Navigation

Interactive components must support:

- Arrow-key navigation within lists
- Enter/Space activation
- Escape dismissal (if applicable)

#### ARIA

- Provide `aria-label` for icon-only buttons
- Label interactive list items properly
- Use semantic roles: `listbox`, `option`, `dialog`, `textbox`, etc.

### 6.6 Visual Consistency

**Radii:** Only use `none`, `sm`, `md`, `lg`, `full`

**Shadows:** Only use `sm`, `md`, `lg`

**Accent Color Usage:**

- Primary actions
- Highlights
- Keyboard focus
- Selected states

Do **not** use accent for decoration or ornamental elements.

---

## 7. Implementation

### 7.1 Monorepo Structure

```
/packages
  /design-system      # Tokens, primitives, themes
  /desktop-app        # Electron React app
  /mobile-app         # React Native (future)
  /editor-core        # Editor package (future)
```

### 7.2 Theme Mechanism

Using vanilla-extract:

- Tokens in contract become CSS variables in the final bundle
- Light and dark themes map into this contract
- Web uses CSS vars directly; React Native consumes the JS objects
- Both share the same conceptual token model

Benefits:

- Strong type safety
- Minimal runtime overhead
- Cross-platform consistency

---

## 8. Component Introduction Criteria

New components may be proposed only when:

1. Multiple features require it
2. It cannot be composed from primitives
3. It aligns with Scribe's design philosophy
4. It uses tokens exclusively
5. It is documented before usage

**Acceptable future additions:**

- Dialog
- Popover
- Tabs
- Tag/Badge
- Toolbar (for editor)

**Unacceptable additions:**

- Highly custom animated widgets
- New layout primitives
- Components with bespoke color rules

---

## 9. Quick Reference

### Do's

- Use primitives for all UI
- Follow token-first styling
- Keep UI quiet and minimal
- Prefer composition over new component creation
- Use semantic naming and variants

### Don'ts

- Hardcode colors or spacing
- Create custom components without DS alignment
- Introduce layout wrappers with custom rules
- Overuse accent color
- Break minimalism with heavy chrome

---

## 10. Implementation Status

This section documents the implementation status of the design system.

### 10.1 Current State Summary

**Status: Design system is IMPLEMENTED.**

The design system has been fully implemented with:

- `/packages/design-system` package with tokens, themes, and primitives
- All vanilla-extract (`*.css.ts`) styles using semantic tokens
- Complete token contract with light and dark themes
- 7 primitive components: Surface, Text, Icon, Button, Input, List/ListItem, Overlay/Portal
- All legacy CSS files migrated and deleted
- Warm amber/gold accent color (#D9A441) throughout

### 10.1.1 Implementation Completed

| Phase   | Description                                                                | Status   |
| ------- | -------------------------------------------------------------------------- | -------- |
| Phase 1 | Foundation (package, tokens, themes, ThemeProvider)                        | Complete |
| Phase 2 | Primitives (Surface, Text, Icon, Button, Input, List, Overlay)             | Complete |
| Phase 3 | CommandPalette Migration                                                   | Complete |
| Phase 4 | Editor Migration (EditorRoot, WikiLinkAutocomplete)                        | Complete |
| Phase 5 | Remaining Components (Toast, BackButton, ErrorNotification, Global Styles) | Complete |
| Phase 6 | Cleanup & Verification (delete legacy CSS, dark mode)                      | Complete |

### 10.2 Current Styling Approach

| File                       | Lines | Description                               |
| -------------------------- | ----- | ----------------------------------------- |
| `index.css`                | 64    | Root CSS variables (misaligned with spec) |
| `App.css`                  | ~104  | Application layout, backlinks overlay     |
| `CommandPalette.css`       | ~327  | Command palette component                 |
| `EditorRoot.css`           | ~228  | Editor and typography styles              |
| `BackButton.css`           | ~46   | Back navigation button                    |
| `Toast.css`                | ~55   | Toast notifications                       |
| `ErrorNotification.css`    | ~64   | Error notification component              |
| `WikiLinkAutocomplete.css` | ~108  | Autocomplete dropdown                     |

**Total CSS to migrate:** ~1,000 lines

### 10.3 Token Misalignment

The current `index.css` defines CSS variables that do not match the specification:

| Current Token            | Current Value          | Specified Token   | Specified Value        |
| ------------------------ | ---------------------- | ----------------- | ---------------------- |
| `--color-bg-primary`     | `#ffffff` (cold white) | `background`      | `#FAF9F7` (warm cream) |
| `--color-bg-secondary`   | `#f5f5f5` (cold gray)  | `backgroundAlt`   | `#F4F1EC` (warm)       |
| `--color-accent`         | `#007aff` (iOS blue)   | `accent`          | `#D9A441` (warm amber) |
| `--color-text-secondary` | `#666666` (cold gray)  | `foregroundMuted` | `#7A756B` (warm)       |
| -                        | -                      | `surface`         | `#EAE6DF` (missing)    |

**Key Issue:** Current palette uses cold neutral blues; specification requires warm neutral amber/gold.

### 10.4 Design System Violations

#### Hardcoded Colors (100+ instances)

**CommandPalette.css examples:**

```css
background-color: #ffffff; /* Should use vars.color.background */
border-bottom: 1px solid #e5e7eb; /* Should use vars.color.border */
color: #6b7280; /* Should use vars.color.foregroundMuted */
background-color: #f3f4f6; /* Should use vars.color.surface */
border-left-color: #3b82f6; /* Using Tailwind blue, not spec accent */
background-color: #dc3545; /* Bootstrap red for delete actions */
```

**EditorRoot.css examples:**

```css
background-color: #ffffff; /* Should use vars.color.background */
color: #1a1a1a; /* Should use vars.color.foreground */
color: #007bff; /* Bootstrap blue for links */
background-color: #f5f5f5; /* Hardcoded code block background */
```

#### Hardcoded Spacing (80+ instances)

```css
padding: 16px; /* Should be vars.spacing[4] */
padding: 12px 16px; /* Should be vars.spacing[3] vars.spacing[4] */
padding: 24px; /* Should be vars.spacing[6] */
gap: 8px; /* Should be vars.spacing[2] */
margin: 0.5rem 0; /* Should use spacing tokens */
```

#### Hardcoded Typography (30+ instances)

| Pattern            | Count | Should Use                      |
| ------------------ | ----- | ------------------------------- |
| `font-size: 12px`  | 6     | `vars.typography.size.xs`       |
| `font-size: 14px`  | 9     | `vars.typography.size.sm`       |
| `font-size: 16px`  | 6     | `vars.typography.size.md`       |
| `font-size: 18px`  | 4     | `vars.typography.size.lg`       |
| `font-weight: 500` | 3     | `vars.typography.weight.medium` |
| `font-weight: 600` | 3     | `vars.typography.weight.bold`   |

#### Hardcoded Shadows

```css
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); /* Should be vars.shadow.md */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* Should be vars.shadow.sm */
box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); /* Non-standard shadow */
```

#### Hardcoded Border Radii

```css
border-radius: 8px; /* Should be vars.radius.md */
border-radius: 6px; /* Should be vars.radius.md */
border-radius: 4px; /* Should be vars.radius.sm */
```

#### Hardcoded Z-Index

```css
z-index: 1000; /* Should be vars.zIndex.palette */
z-index: 2000; /* Should be vars.zIndex.tooltip */
z-index: 10; /* Should be vars.zIndex.overlay */
```

### 10.5 Theme Handling Issues

**Problem 1: Inconsistent dark mode selectors**

- Some files use `[data-theme='dark']` selector
- Some files use `@media (prefers-color-scheme: dark)` query
- No centralized theme mechanism

**Problem 2: No semantic token usage**

- Components handle dark mode independently
- Direct color value switching instead of semantic variables

### 10.6 Components Requiring Migration

| Priority   | Component            | Files                           | Issues                                              |
| ---------- | -------------------- | ------------------------------- | --------------------------------------------------- |
| **High**   | CommandPalette       | `CommandPalette.tsx`, `.css`    | Largest component, key UX element, heavy hardcoding |
| **High**   | EditorRoot           | `EditorRoot.tsx`, `.css`        | Core writing experience, extensive typography       |
| **High**   | Global Styles        | `index.css`, `App.css`          | Foundation for all components                       |
| **Medium** | Toast                | `Toast.tsx`, `.css`             | Notification system                                 |
| **Medium** | BackButton           | `BackButton.tsx`, `.css`        | Navigation element                                  |
| **Medium** | ErrorNotification    | `ErrorNotification.tsx`, `.css` | Error handling UI                                   |
| **Low**    | WikiLinkAutocomplete | Component + CSS                 | Editor enhancement                                  |

### 10.7 New Package Required

```
packages/design-system/
├── package.json
├── tsconfig.json
├── eslint.config.js
└── src/
    ├── index.ts
    ├── tokens/
    │   ├── contract.css.ts      # Token contract definition
    │   ├── values.ts            # Raw token values for RN
    │   └── index.ts
    ├── themes/
    │   ├── light.css.ts         # Light theme implementation
    │   ├── dark.css.ts          # Dark theme implementation
    │   └── index.ts
    └── primitives/
        ├── Surface/
        │   ├── Surface.tsx
        │   ├── Surface.css.ts
        │   └── index.ts
        ├── Text/
        ├── Button/
        ├── Input/
        ├── List/
        ├── Icon/
        ├── Overlay/
        └── index.ts
```

### 10.8 Implementation Phases

#### Phase 1: Foundation (Est. 1 week)

**Create the design system package and tokens**

1. Create `packages/design-system` with package.json and configs
2. Install vanilla-extract and configure with Vite
3. Define token contract (`contract.css.ts`)
4. Create light/dark theme values with warm amber accent
5. Set up exports and workspace references

**Deliverables:**

- Working design-system package
- Type-safe token contract
- Light and dark themes
- Integration with desktop app build

#### Phase 2: Primitives (Est. 1 week)

**Build the core primitive components**

| Order | Primitive     | Complexity | Notes                           |
| ----- | ------------- | ---------- | ------------------------------- |
| 1     | Surface       | Low        | Foundation for all containers   |
| 2     | Text          | Low        | Replace all typography elements |
| 3     | Icon          | Low        | Normalize icon sizing           |
| 4     | Button        | Medium     | Multiple variants and states    |
| 5     | Input         | Medium     | Focus states, icon support      |
| 6     | List/ListItem | Medium     | Keyboard navigation, selection  |
| 7     | Overlay       | Medium     | Portal, backdrop, z-index       |

**Deliverables:**

- 7 primitive components with vanilla-extract styles
- Full TypeScript prop types
- Storybook or test cases for each

#### Phase 3: Command Palette Migration (Est. 1 week)

**Migrate the highest-value component**

1. Replace `CommandPalette.css` with vanilla-extract styles using tokens
2. Refactor `CommandPalette.tsx` to use primitives:
   - `<Overlay>` for backdrop
   - `<Surface>` for palette container
   - `<Input>` for search field
   - `<List>` + `<ListItem>` for results
   - `<Text>` for labels and descriptions
   - `<Icon>` for command icons
3. Remove all hardcoded values
4. Test light/dark theme switching

**Deliverables:**

- Fully migrated CommandPalette
- Zero hardcoded values
- Working theme switching

#### Phase 4: Editor Migration (Est. 1 week)

**Migrate editor typography and styles**

1. Convert `EditorRoot.css` to use tokens
2. Update heading styles (h1-h3) with typography tokens
3. Update paragraph, list, blockquote styles
4. Migrate wiki-link styling to use accent tokens
5. Update `WikiLinkAutocomplete` component

**Deliverables:**

- Token-based editor styling
- Consistent typography scale
- Themed wiki-links

#### Phase 5: Remaining Components (Est. 1 week)

**Migrate supporting components**

1. `Toast` component - notification styling
2. `ErrorNotification` component - error states
3. `BackButton` component - navigation
4. `App.css` backlinks overlay
5. `index.css` global styles cleanup

**Deliverables:**

- All components using design system
- No remaining plain CSS files (except potential resets)

#### Phase 6: Cleanup & Documentation (Est. 3-5 days)

1. Delete legacy `.css` files
2. Verify dark mode works consistently across all components
3. Add visual regression tests
4. Update component documentation
5. Create migration guide for future development

**Deliverables:**

- Clean codebase with no legacy CSS
- Passing visual tests
- Updated documentation

### 10.9 Risk Assessment

| Risk                                  | Severity | Mitigation                                             |
| ------------------------------------- | -------- | ------------------------------------------------------ |
| Visual regressions during migration   | High     | Add screenshot tests before migration begins           |
| Dark mode breakage                    | Medium   | Test both themes during each component migration       |
| Editor typography changes             | High     | Careful review; maintain line heights for readability  |
| Build complexity with vanilla-extract | Low      | Well-supported Vite plugin; existing monorepo patterns |
| Cross-component style conflicts       | Medium   | Migrate in dependency order; Surface first             |

### 10.10 Success Metrics

| Metric                       | Current | Target                  |
| ---------------------------- | ------- | ----------------------- |
| Hardcoded hex colors         | 100+    | 0                       |
| Hardcoded spacing values     | 80+     | 0                       |
| Hardcoded font sizes         | 30+     | 0                       |
| Plain CSS files              | 8       | 0 (or 1 reset)          |
| Type-safe token usage        | 0%      | 100%                    |
| Theme consistency            | Partial | Full light/dark support |
| Primitive component coverage | 0       | 7 primitives            |

---

## 11. Related Documentation

- [Architecture](../../docs/design-system/scribe_design_system_architecture.md) - Foundations & Token Architecture
- [Design Tokens](../../docs/design-system/scribe_design_tokens.md) - Token Architecture & Themes
- [Usage Guidelines](../../docs/design-system/scribe_ds_usage_guidelines.md) - Detailed Usage Rules
- [Primitives Spec](../../docs/design-system/scribe_primitives_spec.md) - Component Specifications
