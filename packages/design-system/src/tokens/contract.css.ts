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
});

export type ThemeVars = typeof vars;
