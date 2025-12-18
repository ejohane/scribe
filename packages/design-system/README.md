# @scribe/design-system

Design system package for Scribe. Provides design tokens, themes, and primitive React components built with [vanilla-extract](https://vanilla-extract.style/).

## Overview

This package serves as the foundation for Scribe's visual language, offering:

- **Design Tokens**: Type-safe CSS variables for colors, spacing, typography, and animations
- **Theme System**: Light/dark theme support with automatic persistence
- **Primitive Components**: Foundational UI building blocks (Surface, Text, Button, Icon, etc.)
- **Icons**: Curated icon set via [lucide-react](https://lucide.dev/)

## Installation

This is an internal monorepo package. It's available to other packages via workspace dependency:

```json
{
  "dependencies": {
    "@scribe/design-system": "workspace:*"
  }
}
```

## Key Exports

### Tokens & Theming

```typescript
import { vars, ThemeProvider, useTheme } from '@scribe/design-system';

// Access design tokens
const style = {
  color: vars.color.text.primary,
  padding: vars.space.md,
  borderRadius: vars.radius.md,
};

// Theme provider wraps your app
<ThemeProvider storage={customStorage}>
  <App />
</ThemeProvider>

// Access theme in components
const { theme, setTheme } = useTheme();
```

### Animations

```typescript
import {
  fadeIn,
  slideUp,
  slideDown,
  spin,
  animateFadeIn,
  animateSlideUp,
} from '@scribe/design-system';
```

### Primitive Components

```typescript
import {
  Surface,
  Text,
  Icon,
  Button,
  Overlay,
  FloatingMenu,
  FloatingMenuItem,
} from '@scribe/design-system';

// Surface - container with background/border
<Surface elevation="raised" padding="md">
  <Text variant="body">Content</Text>
</Surface>

// Button with icon
<Button variant="primary" size="md">
  <Icon name="plus" size="sm" />
  Add Note
</Button>

// Floating menu (for dropdowns, command palettes)
<FloatingMenu>
  <FloatingMenuItem onClick={handleClick}>
    Option 1
  </FloatingMenuItem>
</FloatingMenu>
```

### Style Utilities

```typescript
import {
  emptyStateInline,
  emptyStateCentered,
  panelBase,
  panelTransition,
} from '@scribe/design-system';
```

## Architecture

The design system follows a layered architecture:

1. **Tokens** (`src/tokens/`) - Primitive values (colors, spacing, etc.) defined as CSS custom properties via vanilla-extract's `createThemeContract`
2. **Themes** (`src/themes/`) - Token implementations for light/dark modes
3. **Primitives** (`src/primitives/`) - Low-level React components that consume tokens
4. **Icons** (`src/icons/`) - Icon component wrapping lucide-react

## Dependencies

- `@vanilla-extract/css` - Zero-runtime CSS-in-JS
- `clsx` - Utility for constructing className strings
- `lucide-react` - Icon library

### Peer Dependencies

- `react` ^18.0.0
- `react-dom` ^18.0.0

## Development

```bash
# Run tests
bun run test

# Type check
bun run typecheck

# Lint
bun run lint
```

## Related Documentation

- See `features/design-system/spec.md` for full specification
- See `docs/design-system/` for design tokens and usage guidelines
