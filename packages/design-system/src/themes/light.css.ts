import { createTheme } from '@vanilla-extract/css';
import { vars } from '../tokens/contract.css';

export const lightTheme = createTheme(vars, {
  color: {
    background: '#FAF9F7', // Warm cream
    backgroundAlt: '#F4F1EC', // Subtle warm gray
    surface: '#EAE6DF', // Interactive containers
    border: '#D8D3CB', // Warm gray borders
    foreground: '#1E1C19', // Near-black, warm
    foregroundMuted: '#7A756B', // Warm gray text
    accent: '#D9A441', // Warm amber/gold
    accentForeground: '#1E1C19', // Dark text on accent
    danger: '#B94A48', // Warm red
    warning: '#E2A65C', // Warm orange
    info: '#50698C', // Muted blue
  },
  typography: {
    fontFamily: {
      ui: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"SF Mono", "Fira Code", "Consolas", monospace',
    },
    size: {
      xs: '0.75rem', // 12px
      sm: '0.875rem', // 14px
      md: '1rem', // 16px
      lg: '1.125rem', // 18px
      xl: '1.25rem', // 20px
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
    '1': '0.25rem', // 4px
    '2': '0.5rem', // 8px
    '3': '0.75rem', // 12px
    '4': '1rem', // 16px
    '6': '1.5rem', // 24px
    '8': '2rem', // 32px
    '12': '3rem', // 48px
    '16': '4rem', // 64px
    '24': '6rem', // 96px
  },
  radius: {
    none: '0',
    sm: '0.25rem', // 4px
    md: '0.5rem', // 8px
    lg: '0.75rem', // 12px
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 12px rgba(0, 0, 0, 0.1)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.15)',
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
