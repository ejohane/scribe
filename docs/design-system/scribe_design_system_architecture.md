# Scribe Design System — Steps 1 & 2 (Foundations & Token Architecture)

This document captures the decisions and outputs from **Step 1** (defining the goals and constraints of the Scribe design system) and **Step 2** (defining the token architecture and token categories). These two steps lay the conceptual and structural foundation of the entire Scribe design system.

---

# Step 1 — Goals, Constraints, and Context

## 1. Product Context

Scribe is a:

- **Single-product experience** initially focused on a **desktop React application**.
- Future roadmap includes a **React Native mobile app**, sharing foundations but allowing platform-specific primitives.
- **Single-designer/engineer environment**, prioritizing speed, flexibility, and craftsmanship.

No multi-team adoption complexity, no enterprise-scale constraints, and no need to ship a standalone UI framework.

## 2. Design System Goals

Scribe’s design system aims to:

### **1. Establish a consistent visual language**

- Warm neutral base
- Editorial minimalism
- Calm, distraction-free writing environment

### **2. Stay lightweight and highly maintainable**

- No heavy theme engines
- No external design tokens pipeline
- No enterprise abstractions

### **3. Use a token-first, type-safe foundation**

- Powered by **vanilla-extract**
- Strong TypeScript types for all tokens
- CSS variables for web, raw objects for mobile

### **4. Provide a minimal set of primitives**

- Surface, Text, Button, Input, List/ListItem, Icon, Overlay
- Enough to build the command palette and expand incrementally

### **5. Support light/dark themes**

- Clean, low-friction theme switching
- Semantic color tokens

### **6. Stay aligned with the writing-focused nature of Scribe**

- Elegant typography
- Comfortable color palette
- Minimal chrome
- Keyboard-first UX

## 3. Non-Goals

The system explicitly does **not** aim to:

- Serve as a public UI library
- Include a large catalog of components (tabs, forms, etc.)
- Add Tailwind or utility-class dependencies
- Introduce complex Figma/token syncing workflows
- Support user-generated themes (for v1)

## 4. Monorepo Structure Implications

The design system lives in its own workspace:

```
/packages
  /design-system
  /desktop-app
  /mobile-app (future)
  /editor-core (future)
```

- Shared tokens
- Platform-specific primitives
- Unified styling language

---

# Step 2 — Token Architecture

## 1. Token Philosophy

The Scribe token system is:

- **Semantic first** (foreground.primary > gray.900)
- **Platform-agnostic**
- **Type-safe** via a vanilla-extract contract
- **Lightweight** with minimal categories
- **Expandable** without breaking changes

Tokens are the single source of truth for the system’s visuals.

## 2. Token Categories

The minimal viable token groups are:

### **Colors**

- Neutral tokens (warm-leaning)
- Semantic mapping:
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

### **Z-Index**

- `base, overlay, modal, palette, popover, tooltip`

## 3. Token Contract Structure

A vanilla-extract `createThemeContract` defines the typed token shape.

### **Color Contract**

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
```

### **Typography Contract**

```
typography:
  fontFamily: ui, mono
  size: xs, sm, md, lg, xl
  weight: regular, medium, bold
  lineHeight: tight, normal, relaxed
```

### **Spacing Contract**

```
spacing:
  0, 1, 2, 3, 4, 6, 8, 12, 16, 24
```

### **Radii Contract**

```
radius:
  none, sm, md, lg, full
```

### **Shadow Contract**

```
shadow:
  sm, md, lg
```

### **Z-Index Contract**

```
zIndex:
  base, overlay, modal, palette, popover, tooltip
```

## 4. Theme Mechanism

Using vanilla-extract:

- Tokens in contract become CSS variables in the final bundle
- Light and dark themes map into this contract
- Web uses CSS vars directly; React Native consumes the JS objects
- Both share the same conceptual token model

This ensures:

- Strong type safety
- Minimal runtime overhead
- Cross-platform consistency

---

# Summary of Steps 1 & 2

Steps 1 and 2 establish the philosophical and architectural bedrock of the Scribe design system:

- We defined the goals and constraints that guide all future design decisions
- We created a flexible, semantic, type-safe token system
- We identified the minimal, pragmatic token categories needed to support Scribe’s early UI

These steps flow directly into Step 3 (Theme values) and Step 4 (Primitives), which define the concrete implementation of the design system.
