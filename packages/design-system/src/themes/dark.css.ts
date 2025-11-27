import { createTheme } from '@vanilla-extract/css';
import { vars } from '../tokens/contract.css';

export const darkTheme = createTheme(vars, {
  color: {
    background: '#1A1A18', // Dark warm gray
    backgroundAlt: '#23231F', // Slightly lighter
    surface: '#2C2B27', // Interactive containers
    border: '#3A3935', // Subtle border
    foreground: '#F5F3EE', // Warm off-white
    foregroundMuted: '#A7A398', // Muted warm gray
    accent: '#C2933A', // Slightly muted amber for dark
    accentForeground: '#1A1A18', // Dark text on accent
    danger: '#D06968', // Softer red for dark
    warning: '#D19C5F', // Muted warning
    info: '#6C85A8', // Softer blue
  },
  typography: {
    fontFamily: {
      ui: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"SF Mono", "Fira Code", "Consolas", monospace',
    },
    size: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
    },
    weight: {
      regular: '400',
      medium: '500',
      bold: '600',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },
  spacing: {
    '0': '0',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '6': '1.5rem',
    '8': '2rem',
    '12': '3rem',
    '16': '4rem',
    '24': '6rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.2)',
    md: '0 4px 12px rgba(0, 0, 0, 0.3)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  zIndex: {
    base: '0',
    overlay: '10',
    modal: '100',
    palette: '200',
    popover: '300',
    tooltip: '400',
  },
});
