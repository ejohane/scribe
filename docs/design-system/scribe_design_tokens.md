# Scribe Design System — Step 3: Token Architecture & Themes

This document captures the finalized outcomes from **Step 3** of defining the token system for the Scribe Design System. It includes the aesthetic direction, token categories, final accent choice, full light/dark token values, and vanilla-extract theme contract structure.

---

## 1. Aesthetic Direction

Scribe’s design system uses a hybrid aesthetic blending:

- **Minimalist neutral** (inspired by Obsidian, Raycast, Linear)
- **Warm editorial softness** (inspired by Notion, Medium)

Characteristics:

- Warm, clean neutrals
- Subtle editorial tone
- Minimal elevation
- Crisp typography
- Keyboard-first, writing-focused interactions

The overall feel is modern, calm, premium, and distraction-free.

---

## 2. Accent Color Selection

The chosen accent family is:

### **Warm Amber / Gold (Balanced Tone)**

- Not too bright or neon
- Not too muted or earthy
- Works beautifully across light and dark themes
- Provides a premium, crafted editorial feel
- Distinctive but subtle highlight color for commands, selections, primary actions

This is the **balanced "Option C"** between vibrancy and muted warmth.

---

## 3. Token Categories

The system includes the following token groups:

### **Colors**

- Neutral system (warm-leaning)
- Semantic mappings:
  - `background`, `backgroundAlt`, `surface`, `border`
  - `foreground`, `foregroundMuted`
  - `accent`, `accentForeground`
  - `danger`, `warning`, `info`

### **Typography**

- Font families (UI + mono)
- Font sizes (xs → xl)
- Font weights (regular, medium, bold)
- Line heights (tight, normal, relaxed)

### **Spacing**

- Scale: `0, 1, 2, 3, 4, 6, 8, 12, 16, 24`

### **Radii**

- `none, sm, md, lg, full`

### **Shadows**

- `sm, md, lg`

### **Z-index**

- `base, overlay, modal, palette, popover, tooltip`

---

## 4. Final Color Tokens

Below are the finalized color values (hex) for both themes.

### **Light Theme Colors**

```
background:        #FAF9F7
backgroundAlt:     #F4F1EC
surface:           #EAE6DF
border:            #D8D3CB
foreground:        #1E1C19
foregroundMuted:   #7A756B

accent:            #D9A441
accentForeground:  #1E1C19

danger:            #B94A48
warning:           #E2A65C
info:              #50698C
```

### **Dark Theme Colors**

```
background:        #1A1A18
backgroundAlt:     #23231F
surface:           #2C2B27
border:            #3A3935
foreground:        #F5F3EE
foregroundMuted:   #A7A398

accent:            #C2933A
accentForeground:  #1A1A18

danger:            #D06968
warning:           #D19C5F
info:              #6C85A8
```

---

## 5. Vanilla-Extract Theme Contract

A single token contract (via `createThemeContract`) defines the typed token structure:

```
color:
  background
  backgroundAlt
  surface
  border
  foreground
  foregroundMuted
  accent
  accentForeground
  danger
  warning
  info

typography:
  fontFamily:
    ui
    mono
  size:
    xs, sm, md, lg, xl
  weight:
    regular, medium, bold
  lineHeight:
    tight, normal, relaxed

spacing:
  0, 1, 2, 3, 4, 6, 8, 12, 16, 24

radius:
  none, sm, md, lg, full

shadow:
  sm, md, lg

zIndex:
  base, overlay, modal, palette, popover, tooltip
```

This contract is consumed by both `lightTheme` and `darkTheme` to generate unique CSS variable sets per theme.

---

## 6. Theme Implementation Summary

- Themes are generated via vanilla-extract’s `createTheme(vars, values)`
- Light & dark themes share the same contract shape but map to different values
- Tokens are strongly typed and autocompleted in TypeScript
- Web uses CSS variables; React Native will consume the literal JS objects directly

---

## 7. Output of Step 3

This step establishes the **entire foundation** for Scribe’s design system:

- Aesthetic direction (minimal + editorial hybrid)
- Final accent choice (warm amber/gold)
- Light/dark color palettes
- Full semantic token system
- Typed theme contract (vanilla-extract)
- Foundation for future theming across desktop + mobile

This document will be referenced in Step 4 (Primitives) and future design system operations.
