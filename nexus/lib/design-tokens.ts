// Design Tokens - Centralized Design System
// Based on nexus_UI_.md specifications

export const spacing = {
  0: '0',
  1: '0.25rem',    // 4px
  2: '0.5rem',     // 8px
  3: '0.75rem',    // 12px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  8: '2rem',       // 32px
  10: '2.5rem',    // 40px
  12: '3rem',      // 48px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  24: '6rem',      // 96px
} as const;

export const typography = {
  // Display (Hero headlines)
  display: {
    size: '3.5rem',      // 56px
    lineHeight: '1.1',
    weight: '700',
  },
  
  // H1 (Page titles)
  h1: {
    size: '3rem',        // 48px
    lineHeight: '1.2',
    weight: '700',
  },
  
  // H2 (Section headers)
  h2: {
    size: '2rem',        // 32px
    lineHeight: '1.25',
    weight: '600',
  },
  
  // H3 (Card titles, modal titles)
  h3: {
    size: '1.75rem',     // 28px
    lineHeight: '1.3',
    weight: '600',
  },
  
  // H4 (Subsections)
  h4: {
    size: '1.25rem',     // 20px
    lineHeight: '1.4',
    weight: '600',
  },
  
  // Body
  body: {
    size: '0.9375rem',   // 15px
    lineHeight: '1.6',
    weight: '400',
  },
  
  // Small (Labels, metadata)
  small: {
    size: '0.8125rem',   // 13px
    lineHeight: '1.4',
    weight: '400',
  },
  
  // Tiny (Fine print)
  tiny: {
    size: '0.75rem',     // 12px
    lineHeight: '1.3',
    weight: '400',
  },
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  none: 'none',
} as const;

export const colors = {
  // Primary Purple Gradient
  primary: {
    base: '#7C3AED',
    light: '#A78BFA',
    dark: '#5B21B6',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
  },
  
  // Accent Pink
  accent: {
    base: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)',
  },
  
  // Semantic Colors
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
} as const;

export const borderRadius = {
  sm: '0.375rem',   // 6px
  DEFAULT: '0.5rem', // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  '2xl': '2rem',    // 32px
  full: '9999px',
} as const;

export const animations = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
} as const;
