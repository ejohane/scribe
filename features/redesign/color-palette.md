# Scribe Redesign Color Palette

This document defines the updated color palette for the Scribe redesign, transitioning from the warm amber/cream aesthetic to a cooler, more minimal neutral palette inspired by the POC.

---

## Design Direction

The new palette prioritizes:

- **Clean, pure whites** instead of warm creams
- **Cool gray neutrals** (Tailwind gray/zinc scale)
- **Black as primary accent** for a minimal, editorial feel
- **Subtle blue** for interactive highlights (links, selections)

---

## Light Theme

| Token | Hex | RGB | Description |
|-------|-----|-----|-------------|
| `background` | `#FFFFFF` | `rgb(255, 255, 255)` | Pure white, main app background |
| `backgroundAlt` | `#F9FAFB` | `rgb(249, 250, 251)` | Subtle gray for sidebars, alternate sections |
| `surface` | `#F3F4F6` | `rgb(243, 244, 246)` | Interactive containers, hover states |
| `border` | `#E5E7EB` | `rgb(229, 231, 235)` | Borders and dividers |
| `foreground` | `#111827` | `rgb(17, 24, 39)` | Primary text, near-black |
| `foregroundMuted` | `#6B7280` | `rgb(107, 114, 128)` | Secondary text, placeholders |
| `accent` | `#111827` | `rgb(17, 24, 39)` | Primary actions, selected states (black) |
| `accentForeground` | `#FFFFFF` | `rgb(255, 255, 255)` | Text on accent backgrounds |
| `danger` | `#DC2626` | `rgb(220, 38, 38)` | Error states, destructive actions |
| `dangerForeground` | `#FFFFFF` | `rgb(255, 255, 255)` | Text on danger backgrounds |
| `warning` | `#D97706` | `rgb(217, 119, 6)` | Warning states |
| `info` | `#2563EB` | `rgb(37, 99, 235)` | Informational, links, highlights |

### Light Theme CSS Variables

```css
:root {
  --color-background: #FFFFFF;
  --color-background-alt: #F9FAFB;
  --color-surface: #F3F4F6;
  --color-border: #E5E7EB;
  --color-foreground: #111827;
  --color-foreground-muted: #6B7280;
  --color-accent: #111827;
  --color-accent-foreground: #FFFFFF;
  --color-danger: #DC2626;
  --color-danger-foreground: #FFFFFF;
  --color-warning: #D97706;
  --color-info: #2563EB;
}
```

---

## Dark Theme

| Token | Hex | RGB | Description |
|-------|-----|-----|-------------|
| `background` | `#09090B` | `rgb(9, 9, 11)` | Near-black, main app background |
| `backgroundAlt` | `#18181B` | `rgb(24, 24, 27)` | Slightly lighter for sidebars |
| `surface` | `#27272A` | `rgb(39, 39, 42)` | Interactive containers, hover states |
| `border` | `#3F3F46` | `rgb(63, 63, 70)` | Subtle borders |
| `foreground` | `#F4F4F5` | `rgb(244, 244, 245)` | Primary text, near-white |
| `foregroundMuted` | `#A1A1AA` | `rgb(161, 161, 170)` | Secondary text |
| `accent` | `#FFFFFF` | `rgb(255, 255, 255)` | Primary actions (white, inverted) |
| `accentForeground` | `#09090B` | `rgb(9, 9, 11)` | Text on accent backgrounds |
| `danger` | `#EF4444` | `rgb(239, 68, 68)` | Error states (brighter for dark) |
| `dangerForeground` | `#FFFFFF` | `rgb(255, 255, 255)` | Text on danger backgrounds |
| `warning` | `#F59E0B` | `rgb(245, 158, 11)` | Warning states |
| `info` | `#3B82F6` | `rgb(59, 130, 246)` | Informational, links |

### Dark Theme CSS Variables

```css
[data-theme="dark"] {
  --color-background: #09090B;
  --color-background-alt: #18181B;
  --color-surface: #27272A;
  --color-border: #3F3F46;
  --color-foreground: #F4F4F5;
  --color-foreground-muted: #A1A1AA;
  --color-accent: #FFFFFF;
  --color-accent-foreground: #09090B;
  --color-danger: #EF4444;
  --color-danger-foreground: #FFFFFF;
  --color-warning: #F59E0B;
  --color-info: #3B82F6;
}
```

---

## Comparison: Old vs New

| Token | Old (Warm) | New (Cool) |
|-------|-----------|-----------|
| `background` | `#FAF9F7` (cream) | `#FFFFFF` (white) |
| `backgroundAlt` | `#F4F1EC` (beige) | `#F9FAFB` (gray-50) |
| `surface` | `#EAE6DF` (tan) | `#F3F4F6` (gray-100) |
| `border` | `#D8D3CB` (warm gray) | `#E5E7EB` (gray-200) |
| `foreground` | `#1E1C19` (warm black) | `#111827` (gray-900) |
| `foregroundMuted` | `#7A756B` (warm gray) | `#6B7280` (gray-500) |
| `accent` | `#D9A441` (amber) | `#111827` (black) |

---

## Additional Token Updates

### Border Radius

The POC uses larger, softer radii for a more modern feel:

| Token | Old | New | Notes |
|-------|-----|-----|-------|
| `none` | `0` | `0` | No change |
| `sm` | `0.25rem` (4px) | `0.375rem` (6px) | Slightly larger |
| `md` | `0.5rem` (8px) | `0.5rem` (8px) | No change |
| `lg` | `0.75rem` (12px) | `0.75rem` (12px) | No change |
| `xl` | - | `1rem` (16px) | **New** - for command palette, cards |
| `2xl` | - | `1.5rem` (24px) | **New** - for large modals |
| `full` | `9999px` | `9999px` | No change |

### Shadows

Updated for softer, more diffuse appearance:

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | `0 1px 2px rgba(0, 0, 0, 0.05)` | Subtle elevation |
| `md` | `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)` | Cards, dropdowns |
| `lg` | `0 8px 30px rgba(0, 0, 0, 0.12)` | Command palette, modals |
| `xl` | `0 20px 40px rgba(0, 0, 0, 0.12)` | **New** - floating dock |

### Typography

| Token | Value | Notes |
|-------|-------|-------|
| `fontFamily.ui` | `"Inter", -apple-system, BlinkMacSystemFont, sans-serif` | Updated to Inter |
| `fontFamily.serif` | `"Merriweather", Georgia, serif` | **New** - for note titles |
| `fontFamily.mono` | `"SF Mono", "Fira Code", monospace` | No change |

---

## Implementation

To apply these changes, update the following files:

1. `packages/design-system/src/themes/light.css.ts`
2. `packages/design-system/src/themes/dark.css.ts`
3. `packages/design-system/src/tokens/contract.css.ts` (for new tokens like `xl` radius)

### vanilla-extract Implementation

```typescript
// light.css.ts
export const lightTheme = createTheme(vars, {
  color: {
    background: '#FFFFFF',
    backgroundAlt: '#F9FAFB',
    surface: '#F3F4F6',
    border: '#E5E7EB',
    foreground: '#111827',
    foregroundMuted: '#6B7280',
    accent: '#111827',
    accentForeground: '#FFFFFF',
    danger: '#DC2626',
    dangerForeground: '#FFFFFF',
    warning: '#D97706',
    info: '#2563EB',
  },
  // ... rest of tokens
});

// dark.css.ts
export const darkTheme = createTheme(vars, {
  color: {
    background: '#09090B',
    backgroundAlt: '#18181B',
    surface: '#27272A',
    border: '#3F3F46',
    foreground: '#F4F4F5',
    foregroundMuted: '#A1A1AA',
    accent: '#FFFFFF',
    accentForeground: '#09090B',
    danger: '#EF4444',
    dangerForeground: '#FFFFFF',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  // ... rest of tokens
});
```

---

## Color Scale Reference

For reference, here are the full Tailwind gray and zinc scales used:

### Gray (Light Theme)

| Name | Hex |
|------|-----|
| gray-50 | `#F9FAFB` |
| gray-100 | `#F3F4F6` |
| gray-200 | `#E5E7EB` |
| gray-300 | `#D1D5DB` |
| gray-400 | `#9CA3AF` |
| gray-500 | `#6B7280` |
| gray-600 | `#4B5563` |
| gray-700 | `#374151` |
| gray-800 | `#1F2937` |
| gray-900 | `#111827` |

### Zinc (Dark Theme)

| Name | Hex |
|------|-----|
| zinc-50 | `#FAFAFA` |
| zinc-100 | `#F4F4F5` |
| zinc-200 | `#E4E4E7` |
| zinc-300 | `#D4D4D8` |
| zinc-400 | `#A1A1AA` |
| zinc-500 | `#71717A` |
| zinc-600 | `#52525B` |
| zinc-700 | `#3F3F46` |
| zinc-800 | `#27272A` |
| zinc-900 | `#18181B` |
| zinc-950 | `#09090B` |
