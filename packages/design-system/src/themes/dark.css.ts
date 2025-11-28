import { createTheme } from '@vanilla-extract/css';
import { vars } from '../tokens/contract.css';

export const darkTheme = createTheme(vars, {
  color: {
    background: '#09090B', // zinc-950 - near-black
    backgroundAlt: '#18181B', // zinc-900 - slightly lighter for sidebars
    surface: '#27272A', // zinc-800 - interactive containers
    border: '#3F3F46', // zinc-700 - subtle borders
    foreground: '#F4F4F5', // zinc-100 - primary text, near-white
    foregroundMuted: '#A1A1AA', // zinc-400 - secondary text
    accent: '#FFFFFF', // white - primary actions (inverted)
    accentForeground: '#09090B', // zinc-950 - text on accent
    danger: '#EF4444', // red-500 - brighter for dark mode
    dangerForeground: '#FFFFFF', // white
    warning: '#F59E0B', // amber-500
    info: '#3B82F6', // blue-500
  },
  typography: {
    fontFamily: {
      ui: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"SF Mono", "Fira Code", "Consolas", monospace',
      serif: '"Merriweather", Georgia, serif',
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
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.2)',
    md: '0 4px 12px rgba(0, 0, 0, 0.3)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.4)',
    xl: '0 20px 40px rgba(0, 0, 0, 0.24)', // Higher opacity for dark mode
  },
  zIndex: {
    base: '0',
    overlay: '10',
    modal: '100',
    palette: '200',
    popover: '300',
    tooltip: '400',
  },
  animation: {
    duration: {
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
      slower: '500ms',
    },
    easing: {
      default: 'ease-out',
      smooth: 'cubic-bezier(0.32, 0.72, 0, 1)',
    },
  },
});
