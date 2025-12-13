import { createThemeContract } from '@vanilla-extract/css';

export const vars = createThemeContract({
  color: {
    background: null,
    backgroundAlt: null,
    surface: null,
    border: null,
    foreground: null,
    foregroundMuted: null,
    accent: null,
    accentForeground: null,
    danger: null,
    dangerForeground: null,
    warning: null,
    info: null,
    success: null, // semantic green for completed tasks, confirmations
    secondary: null, // semantic teal for people, attendees
    tertiary: null, // semantic purple for links, references
    // Backdrop colors for overlays
    backdropLight: null, // lighter backdrop (e.g., for blur effect)
    backdropDark: null, // darker backdrop (e.g., for solid overlay)
  },
  typography: {
    fontFamily: {
      ui: null,
      mono: null,
      serif: null,
    },
    size: {
      xs: null,
      sm: null,
      md: null,
      lg: null,
      xl: null,
      '2xl': null,
      '3xl': null,
    },
    weight: {
      regular: null,
      medium: null,
      bold: null,
    },
    lineHeight: {
      tight: null,
      normal: null,
      relaxed: null,
    },
    letterSpacing: {
      tight: null, // -0.025em
      normal: null, // 0
      wide: null, // 0.05em - for uppercase labels
    },
  },
  spacing: {
    '0': null,
    '1': null,
    '2': null,
    '3': null,
    '4': null,
    '6': null,
    '8': null,
    '12': null,
    '16': null,
    '24': null,
  },
  radius: {
    none: null,
    sm: null,
    md: null,
    lg: null,
    xl: null,
    '2xl': null,
    full: null,
  },
  shadow: {
    sm: null,
    md: null,
    lg: null,
    xl: null,
  },
  zIndex: {
    base: null,
    overlay: null,
    modal: null,
    palette: null,
    popover: null,
    tooltip: null,
  },
  animation: {
    duration: {
      fast: null,
      normal: null,
      slow: null,
      slower: null,
    },
    easing: {
      default: null,
      smooth: null,
    },
  },
  // Component-specific sizing tokens
  component: {
    icon: {
      xs: null, // 12px - 0.75rem
      sm: null, // 16px - 1rem
      md: null, // 20px - 1.25rem
      lg: null, // 24px - 1.5rem
    },
    button: {
      heightSm: null, // 28px - 1.75rem
      heightMd: null, // 36px - 2.25rem
    },
    menu: {
      minWidthSm: null, // 160px
      maxWidthSm: null, // 240px
      minWidthMd: null, // 200px
      maxWidthMd: null, // 320px
      minWidthLg: null, // 280px
      maxWidthLg: null, // 400px
      maxHeight: null, // 300px
      iconSize: null, // 32px
    },
    spinner: {
      size: null, // 14px
    },
    panel: {
      slideOffset: null, // 40px - slide animation offset
      defaultWidth: null, // 280px
    },
  },
  // Blur effect tokens
  blur: {
    sm: null, // 4px
    md: null, // 8px
    lg: null, // 12px
  },
});

export type ThemeVars = typeof vars;
