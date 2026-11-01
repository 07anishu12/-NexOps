export const designTokens = {
  colors: {
    brand: {
      primary: '#2563eb', // Indigo / Blue
      primaryHover: '#1d4ed8',
      accent: '#06b6d4', // Cyan
      background: '#090d16',
      card: '#111827',
      border: '#1f2937',
      foreground: '#f9fafb'
    },
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    }
  },
  typography: {
    fontSans: 'Inter, system-ui, -apple-system, sans-serif',
    fontMono: 'JetBrains Mono, Menlo, monospace'
  },
  radii: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px'
  }
} as const;

export type DesignTokens = typeof designTokens;
