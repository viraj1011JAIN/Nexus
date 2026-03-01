// Spacing Utility - Apply consistent spacing patterns
// Based on 8-point grid system

export const apply = {
  page: 'p-8 space-y-12',
  section: 'space-y-8',
  card: 'p-6 space-y-4',
  cardCompact: 'p-4 space-y-3',
  header: 'space-y-3',
  buttons: 'flex gap-4',
  grid: 'grid gap-6',
  gridCompact: 'grid gap-4',
} as const;

// Typography classes for easy application
export const textClasses = {
  display: 'text-[3.5rem] leading-tight font-bold',
  h1: 'text-5xl leading-tight font-bold',
  h2: 'text-4xl leading-tight font-semibold',
  h3: 'text-3xl leading-snug font-semibold',
  h4: 'text-2xl leading-snug font-semibold',
  body: 'text-[15px] leading-relaxed',
  small: 'text-[13px] leading-normal',
} as const;

// Shadow classes for elevation
export const shadowClasses = {
  sm: 'shadow-sm',
  md: 'shadow-md hover:shadow-xl',
  lg: 'shadow-lg hover:shadow-2xl',
  card: 'shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200',
} as const;

// Gradient classes
export const gradientClasses = {
  primary: 'bg-linear-to-r from-purple-600 to-pink-600',
  primaryText: 'bg-linear-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent',
  button: 'bg-linear-to-r from-purple-600 to-purple-700',
  buttonShadow: 'shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40',
} as const;
