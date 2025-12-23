# Decision 11: Design System Architecture

This document defines the architecture of Scribe's **design system**. It covers the token-based theming approach, primitive component library, and runtime theme switching.

The design system is the foundation of Scribe's UI, ensuring visual consistency and maintainability across all components.

---

# 1. Overview

Scribe's design system follows a **token-based architecture** using vanilla-extract:

1. **Tokens**: CSS variables for colors, spacing, typography, and more
2. **Themes**: Dark/light mode values that implement the token contract
3. **Primitives**: Reusable, composable React components
4. **ThemeProvider**: Runtime theme switching with persistence

```
Token Contract (CSS Variables)
    ↓ createTheme()
Theme (dark.css.ts, light.css.ts)
    ↓ applied to document.documentElement
Primitives (Button, Surface, Text, Icon)
    ↓ reference vars
UI Components
```

---

# 2. Design Principles

## 2.1 Tokens Over Hard-coded Values

```typescript
// BAD: Hard-coded values
const button = style({
  backgroundColor: '#3B82F6',
  padding: '8px 16px',
});

// GOOD: Token references
const button = style({
  backgroundColor: vars.color.accent,
  padding: `${vars.spacing[2]} ${vars.spacing[4]}`,
});
```

## 2.2 Composition Over Inheritance

Primitives are designed to compose together:

```tsx
<Surface variant="elevated" padding="4" radius="md">
  <Text size="lg" weight="bold">Title</Text>
  <Text color="foregroundMuted">Description</Text>
  <Button variant="solid" tone="accent">Action</Button>
</Surface>
```

## 2.3 Type-Safe Styling

All tokens and variants are fully typed:

```typescript
// Autocomplete for all valid spacing values
<Surface padding="4" />  // ✓
<Surface padding="5" />  // ✗ Type error: '5' not in spacing tokens
```

---

# 3. Token Architecture

## 3.1 Token Contract

The token contract defines CSS variable slots without values:

```typescript
// packages/design-system/src/tokens/contract.css.ts
import { createThemeContract } from '@vanilla-extract/css';

export const vars = createThemeContract({
  color: {
    background: null,      // Base background
    backgroundAlt: null,   // Sidebar/alternate areas
    surface: null,         // Elevated containers
    border: null,          // Borders and dividers
    foreground: null,      // Primary text
    foregroundMuted: null, // Secondary text
    accent: null,          // Primary brand/action color
    accentForeground: null,// Text on accent backgrounds
    danger: null,          // Destructive actions
    success: null,         // Completed tasks, confirmations
    secondary: null,       // People/attendees (teal)
    tertiary: null,        // Links/references (purple)
    // ... more colors
  },
  typography: {
    fontFamily: { ui: null, mono: null, serif: null },
    size: { xs: null, sm: null, md: null, lg: null, xl: null, '2xl': null, '3xl': null },
    weight: { regular: null, medium: null, bold: null },
    lineHeight: { tight: null, normal: null, relaxed: null },
    letterSpacing: { tight: null, normal: null, wide: null },
  },
  spacing: {
    '0': null, '1': null, '2': null, '3': null, '4': null,
    '6': null, '8': null, '12': null, '16': null, '24': null,
  },
  radius: { none: null, sm: null, md: null, lg: null, xl: null, '2xl': null, full: null },
  shadow: { sm: null, md: null, lg: null, xl: null },
  zIndex: { base: null, overlay: null, modal: null, palette: null, popover: null, tooltip: null },
  animation: {
    duration: { fast: null, normal: null, slow: null, slower: null },
    easing: { default: null, smooth: null },
  },
  component: {
    icon: { xs: null, sm: null, md: null, lg: null },
    button: { heightSm: null, heightMd: null },
    menu: { minWidthSm: null, maxWidthSm: null, /* ... */ },
    panel: { slideOffset: null, defaultWidth: null },
  },
  blur: { sm: null, md: null, lg: null },
});
```

## 3.2 Theme Values

Themes implement the contract with concrete values:

```typescript
// packages/design-system/src/themes/dark.css.ts
export const darkTheme = createTheme(vars, {
  color: {
    background: '#09090B',        // zinc-950
    backgroundAlt: '#18181B',     // zinc-900
    surface: '#27272A',           // zinc-800
    border: 'rgba(255, 255, 255, 0.06)',
    foreground: '#F4F4F5',        // zinc-100
    foregroundMuted: '#A1A1AA',   // zinc-400
    accent: '#3B82F6',            // blue-500
    accentForeground: '#FFFFFF',
    danger: '#EF4444',            // red-500
    success: '#22C55E',           // green-500
    secondary: '#10B981',         // emerald-500
    tertiary: '#8B5CF6',          // violet-500
    // ...
  },
  typography: {
    fontFamily: {
      ui: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"SF Mono", "Fira Code", "Consolas", monospace',
      serif: '"Merriweather", Georgia, serif',
    },
    size: {
      xs: '0.75rem',   // 12px
      sm: '0.875rem',  // 14px
      md: '1rem',      // 16px
      lg: '1.125rem',  // 18px
      xl: '1.25rem',   // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '2.5rem', // 40px
    },
    weight: { regular: '400', medium: '500', bold: '600' },
    lineHeight: { tight: '1.25', normal: '1.5', relaxed: '1.75' },
    letterSpacing: { tight: '-0.025em', normal: '0', wide: '0.05em' },
  },
  spacing: {
    '0': '0',
    '1': '0.25rem',  // 4px
    '2': '0.5rem',   // 8px
    '3': '0.75rem',  // 12px
    '4': '1rem',     // 16px
    '6': '1.5rem',   // 24px
    '8': '2rem',     // 32px
    '12': '3rem',    // 48px
    '16': '4rem',    // 64px
    '24': '6rem',    // 96px
  },
  radius: {
    none: '0',
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    '2xl': '1.5rem', // 24px
    full: '9999px',
  },
  // ...
});
```

---

# 4. Theme Provider

The `ThemeProvider` component manages runtime theme switching:

```typescript
// packages/design-system/src/ThemeProvider.tsx
interface ThemeContextValue {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'scribe-theme',
  storage,
}: ThemeProviderProps) {
  // Load saved preference on mount
  // Listen for system preference changes
  // Apply theme class to document.documentElement
  // Persist preference to storage
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

## 4.1 Usage

```tsx
// Root of application
<ThemeProvider defaultTheme="system">
  <App />
</ThemeProvider>

// In any component
function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  return (
    <Button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </Button>
  );
}
```

## 4.2 Custom Storage

For Electron apps, use IPC for persistence:

```tsx
const electronStorage: ThemeStorage = {
  getTheme: () => window.scribe.settings.getTheme(),
  setTheme: (theme) => window.scribe.settings.setTheme(theme),
};

<ThemeProvider storage={electronStorage}>
```

---

# 5. Primitive Components

The design system provides composable primitive components:

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| **Surface** | Container with background, elevation, borders | `variant`, `elevation`, `padding`, `radius`, `bordered` |
| **Text** | Typography with semantic sizing | `size`, `weight`, `color`, `mono`, `truncate`, `as` |
| **Button** | Interactive button with variants | `variant`, `tone`, `size`, `iconLeft`, `iconRight` |
| **Icon** | SVG icon wrapper with sizing | `size`, `color`, `children` |
| **Overlay** | Modal backdrop with blur | `onClose`, `children` |
| **Portal** | Render outside component tree | `container`, `children` |
| **FloatingMenu** | Dropdown/context menus | `items`, `trigger`, `position` |
| **Calendar** | Date display widget | `value`, `onChange` |
| **DatePicker** | Date input control | `value`, `onChange` |
| **CollapsiblePanel** | Expandable sidebar panels | `isOpen`, `onToggle` |
| **EmptyState** | Placeholder for empty content | `icon`, `title`, `description` |

## 5.1 Surface

Polymorphic container component:

```tsx
<Surface 
  variant="surface"      // 'surface' | 'background' | 'backgroundAlt'
  elevation="md"         // 'none' | 'sm' | 'md' | 'lg'
  padding="4"            // Spacing token key
  radius="md"            // 'none' | 'sm' | 'md' | 'lg' | 'full'
  bordered
  as="section"           // Polymorphic element type
>
  {children}
</Surface>
```

## 5.2 Text

Polymorphic typography component:

```tsx
<Text 
  size="lg"              // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  weight="bold"          // 'regular' | 'medium' | 'bold'
  color="foregroundMuted" // Semantic color
  mono                    // Use monospace font
  truncate                // Ellipsis overflow
  as="h1"                 // Polymorphic element type
>
  {children}
</Text>
```

## 5.3 Button

Interactive button with variant system:

```tsx
<Button 
  variant="solid"        // 'solid' | 'ghost' | 'subtle'
  tone="accent"          // 'accent' | 'neutral' | 'danger'
  size="md"              // 'sm' | 'md'
  iconLeft={<Icon><PlusIcon /></Icon>}
  iconRight={<Icon><ChevronIcon /></Icon>}
  aria-pressed={isActive} // For toggle buttons
>
  {children}
</Button>
```

## 5.4 Icon

SVG icon wrapper with sizing:

```tsx
<Icon 
  size="md"              // 'xs' (12px) | 'sm' (16px) | 'md' (20px) | 'lg' (24px)
  color="accent"         // Semantic color
>
  <SvgIcon />
</Icon>
```

---

# 6. Animation Tokens

Keyframes and animation utilities:

```typescript
// packages/design-system/src/tokens/animations.css.ts

// Keyframes
export const fadeIn = keyframes({ '0%': { opacity: 0 }, '100%': { opacity: 1 } });
export const slideUp = keyframes({ '0%': { opacity: 0, transform: 'translateY(10px)' }, /* ... */ });
export const slideDown = keyframes({ /* ... */ });
export const spin = keyframes({ from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } });

// Composed animation classes
export const animateFadeIn = style({
  animation: `${fadeIn} ${vars.animation.duration.normal} ${vars.animation.easing.default} forwards`,
});
export const animateSlideUp = style({
  animation: `${slideUp} ${vars.animation.duration.slow} ${vars.animation.easing.default} forwards`,
});
export const animateSpin = style({
  animation: `${spin} 1s linear infinite`,
});
```

## 6.1 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

# 7. Style Patterns

## 7.1 Recipe-based Variants (vanilla-extract)

```typescript
// Button.css.ts
import { recipe } from '@vanilla-extract/recipes';

export const button = recipe({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: vars.radius.md,
    fontWeight: vars.typography.weight.medium,
    transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  },
  variants: {
    size: {
      sm: { height: vars.component.button.heightSm, padding: `0 ${vars.spacing[2]}` },
      md: { height: vars.component.button.heightMd, padding: `0 ${vars.spacing[4]}` },
    },
    variant: {
      solid: {},
      ghost: { background: 'transparent' },
      subtle: {},
    },
    tone: {
      accent: {},
      neutral: {},
      danger: {},
    },
  },
  compoundVariants: [
    { variants: { variant: 'solid', tone: 'accent' }, style: { background: vars.color.accent } },
    { variants: { variant: 'solid', tone: 'danger' }, style: { background: vars.color.danger } },
    // ...
  ],
});
```

## 7.2 Composition Example

```tsx
function NoteCard({ title, summary, date }: NoteCardProps) {
  return (
    <Surface variant="surface" elevation="sm" padding="4" radius="md">
      <Text as="h3" size="lg" weight="bold">{title}</Text>
      <Text color="foregroundMuted" truncate>{summary}</Text>
      <Text size="xs" color="foregroundMuted">{date}</Text>
    </Surface>
  );
}
```

---

# 8. Package Structure

```
packages/design-system/src/
  tokens/
    contract.css.ts    # CSS variable slots (createThemeContract)
    animations.css.ts  # Keyframes and animation utilities
    index.ts           # Barrel exports
  themes/
    dark.css.ts        # Dark theme values
    light.css.ts       # Light theme values
    index.ts           # Barrel exports
  primitives/
    Button/
      Button.tsx       # Component implementation
      Button.css.ts    # Styles (recipe/style)
      Button.test.tsx  # Unit tests
      index.ts         # Barrel export
    Surface/
    Text/
    Icon/
    Overlay/
    Portal/
    FloatingMenu/
    Calendar/
    DatePicker/
    CollapsiblePanel/
    EmptyState/
    index.ts           # Barrel exports all primitives
  icons/
    icons.tsx          # SVG icon definitions
    index.ts           # Barrel exports
  ThemeProvider.tsx    # Theme context and provider
  index.ts             # Package entry point
```

---

# 9. Rationale

## 9.1 Why vanilla-extract Over CSS-in-JS Runtime

| Factor | vanilla-extract | Runtime CSS-in-JS |
|--------|-----------------|-------------------|
| Bundle size | Zero runtime | +10-30KB |
| Performance | Static CSS, no runtime | Style injection on render |
| Type safety | Full TypeScript | Varies |
| DevX | Good (IDE support) | Good |
| SSR | Zero-config | Needs hydration |

vanilla-extract generates static CSS at build time, avoiding the runtime overhead of styled-components or emotion.

## 9.2 Why Contract-based Theming

The contract pattern ensures:

1. **Theme completeness**: Every theme must implement all tokens
2. **Type safety**: Token references are compile-time checked
3. **Refactoring**: Rename a token, get errors everywhere it's used
4. **Documentation**: The contract is the single source of truth

## 9.3 Why Primitives Over Complex Components

Primitives are:

- **Composable**: Build any UI from simple building blocks
- **Predictable**: One responsibility per component
- **Themeable**: All styling through tokens
- **Testable**: Simple props, simple tests
- **Accessible**: Built-in ARIA support

Complex domain components (NoteCard, TaskList) are built from primitives in the application layer, not the design system.

---

# 10. Key Files

| File | Purpose |
|------|---------|
| `packages/design-system/src/tokens/contract.css.ts` | Token contract (CSS variable slots) |
| `packages/design-system/src/themes/dark.css.ts` | Dark theme implementation |
| `packages/design-system/src/themes/light.css.ts` | Light theme implementation |
| `packages/design-system/src/tokens/animations.css.ts` | Animation keyframes and utilities |
| `packages/design-system/src/ThemeProvider.tsx` | Theme context and runtime switching |
| `packages/design-system/src/primitives/` | Primitive component library |

---

# 11. Final Definition

**Decision 11 establishes Scribe's design system architecture:** A token-based theming approach using vanilla-extract's `createThemeContract` for type-safe CSS variables, dark/light theme implementations, and a library of composable primitive components (Surface, Text, Button, Icon, etc.). The ThemeProvider enables runtime theme switching with system preference detection and persistence. This architecture ensures visual consistency, type safety, zero-runtime overhead, and easy maintenance as the UI grows.
