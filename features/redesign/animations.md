# Scribe Redesign - Animation Specifications

This document defines the animations and transitions used in the POC that should be implemented in the redesign.

---

## Animation Tokens

These should be added to the design system for consistent use across components.

### Durations

| Token | Value | Usage |
|-------|-------|-------|
| `duration.fast` | `150ms` | Micro-interactions (button states, icon changes) |
| `duration.normal` | `200ms` | Standard transitions (hover, focus) |
| `duration.slow` | `300ms` | Content transitions (fade in, slide up) |
| `duration.slower` | `500ms` | Layout changes (sidebar collapse/expand) |

### Easing Functions

| Token | Value | Usage |
|-------|-------|-------|
| `easing.default` | `ease-out` | General purpose |
| `easing.smooth` | `cubic-bezier(0.32, 0.72, 0, 1)` | Sidebar collapse/expand, panel transitions |
| `easing.bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful micro-interactions (optional) |

---

## Keyframe Animations

### fadeIn

Used for: Editor content, floating menus

```css
@keyframes fadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}
```

### slideUp

Used for: Command palette, AI loading indicator, toasts

```css
@keyframes slideUp {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slideUp 0.3s ease-out forwards;
}
```

### enter (composite)

Used for: Selection toolbar (fade + scale)

```css
@keyframes enter {
  from {
    opacity: var(--enter-opacity, 1);
    transform: translate3d(var(--enter-translate-x, 0), var(--enter-translate-y, 0), 0) 
               scale3d(var(--enter-scale, 1), var(--enter-scale, 1), 1);
  }
}

.animate-in {
  animation: enter 150ms;
}

.fade-in {
  --enter-opacity: 0;
}

.zoom-in-95 {
  --enter-scale: 0.95;
}
```

### spin

Used for: Loading spinners

```css
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
```

---

## Component-Specific Animations

### Sidebar (Left & Right Panels)

**Collapse/Expand Animation:**
- Duration: `500ms`
- Easing: `cubic-bezier(0.32, 0.72, 0, 1)`
- Properties: `width`, `opacity`, `transform`

```css
/* Sidebar container */
.sidebar {
  transition: all 500ms cubic-bezier(0.32, 0.72, 0, 1);
}

/* Open state */
.sidebar-open {
  width: 320px;
  opacity: 1;
  transform: translateX(0);
}

/* Closed state (left sidebar) */
.sidebar-closed-left {
  width: 0;
  opacity: 0;
  transform: translateX(-40px);
  overflow: hidden;
}

/* Closed state (right sidebar) */
.sidebar-closed-right {
  width: 0;
  opacity: 0;
  transform: translateX(40px);
  overflow: hidden;
}
```

### Floating Action Dock

**Hover Animation:**
- Duration: instant on hover
- Properties: `scale`, `box-shadow`

```css
.floating-dock {
  transition: all;
}

.floating-dock:hover {
  transform: scale(1.05);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
}
```

### Command Palette

**Entry Animation:**
- Animation: `slideUp`
- Duration: `300ms`
- Easing: `ease-out`

```css
.command-palette {
  animation: slideUp 0.3s ease-out forwards;
}
```

**Backdrop:**
- Properties: `opacity`
- Uses: `backdrop-filter: blur()`

### Floating Menus (Slash, Mention, Link)

**Entry Animation:**
- Animation: `fadeIn`
- Duration: `200ms`
- Easing: `ease-out`

```css
.floating-menu {
  animation: fadeIn 0.2s ease-out forwards;
}
```

### Selection Toolbar

**Entry Animation:**
- Animation: `enter` (composite)
- Duration: `200ms`
- Properties: `opacity`, `scale`
- Start scale: `0.95`

```css
.selection-toolbar {
  animation: enter 200ms;
  --enter-opacity: 0;
  --enter-scale: 0.95;
}
```

### Note List Items

**Hover/Active Transitions:**
- Duration: `200ms`
- Properties: `background-color`, `box-shadow`, `border-color`

```css
.note-list-item {
  transition: all 200ms;
}
```

**Delete Button Reveal:**
- Duration: inherited
- Properties: `opacity`

```css
.delete-button {
  opacity: 0;
  transition: all;
}

.note-list-item:hover .delete-button {
  opacity: 1;
}
```

### New Note Button

**Hover Animation:**
- Duration: `200ms`
- Properties: `background-color`, `color`, `box-shadow`, `border-color`

```css
.new-note-button {
  transition: all 200ms;
}

/* Icon circle inverts on hover */
.new-note-button .icon-circle {
  transition: all;
}

.new-note-button:hover .icon-circle {
  background-color: black;
  color: white;
}
```

### Theme Toggle

**Color Transitions:**
- Duration: `300ms`
- Properties: `background-color`, `color`

```css
body {
  transition: background-color 0.3s, color 0.3s;
}
```

### Page Links (Wiki Links)

**Hover Transition:**
- Duration: `200ms`
- Properties: `background-color`, `color`, `border-color`

```css
.page-link {
  transition: all 0.2s;
}
```

### Context Panel Cards

**Hover Transition:**
- Duration: inherited (default)
- Properties: `background-color`

```css
.context-card-item {
  transition: colors;
}

.context-card-item:hover {
  background-color: var(--color-surface);
}
```

---

## Glassmorphism Effects

Used in: Floating dock, sidebars, floating menus

```css
.glass {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.glass-dark {
  background: rgba(24, 24, 27, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

---

## Implementation Notes

### vanilla-extract

Animations can be defined using `@vanilla-extract/css`:

```typescript
// animations.css.ts
import { keyframes, style } from '@vanilla-extract/css';

export const fadeIn = keyframes({
  '0%': { opacity: 0 },
  '100%': { opacity: 1 },
});

export const slideUp = keyframes({
  '0%': { opacity: 0, transform: 'translateY(10px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

export const animateFadeIn = style({
  animation: `${fadeIn} 0.2s ease-out forwards`,
});

export const animateSlideUp = style({
  animation: `${slideUp} 0.3s ease-out forwards`,
});
```

### Token Integration

Add to `packages/design-system/src/tokens/contract.css.ts`:

```typescript
export const vars = createThemeContract({
  // ... existing tokens
  
  animation: {
    duration: {
      fast: null,    // '150ms'
      normal: null,  // '200ms'
      slow: null,    // '300ms'
      slower: null,  // '500ms'
    },
    easing: {
      default: null, // 'ease-out'
      smooth: null,  // 'cubic-bezier(0.32, 0.72, 0, 1)'
    },
  },
});
```

---

## Accessibility Considerations

### Reduced Motion

Respect user preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Focus Transitions

Ensure focus indicators have appropriate transitions but don't rely solely on animation for visibility:

```css
.interactive-element:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  transition: outline-offset 0.1s ease-out;
}
```
