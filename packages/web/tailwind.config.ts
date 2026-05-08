import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Financial theme colors
        success: {
          DEFAULT: 'hsl(142, 76%, 36%)',
          foreground: 'hsl(0, 0%, 100%)',
        },
        warning: {
          DEFAULT: 'hsl(38, 92%, 50%)',
          foreground: 'hsl(0, 0%, 100%)',
        },
        chart: {
          1: 'hsl(221, 83%, 53%)', // Blue
          2: 'hsl(142, 76%, 36%)', // Green
          3: 'hsl(38, 92%, 50%)', // Amber
          4: 'hsl(280, 65%, 60%)', // Purple
          5: 'hsl(346, 77%, 49%)', // Red
        },
        // DS-01: Editorial Stability palette
        'ds-background': 'hsl(var(--ds-background))',
        'ds-surface': 'hsl(var(--ds-surface))',
        'ds-surface-raised': 'hsl(var(--ds-surface-raised))',
        'ds-surface-overlay': 'hsl(var(--ds-surface-overlay))',
        'ds-surface-container': 'hsl(var(--ds-surface-container))',
        'ds-surface-bright': 'hsl(var(--ds-surface-bright))',
        'ds-surface-dim': 'hsl(var(--ds-surface-dim))',
        'ds-primary': 'hsl(var(--ds-primary))',
        'ds-on-primary': 'hsl(var(--ds-on-primary))',
        'ds-primary-container': 'hsl(var(--ds-primary-container))',
        'ds-on-primary-container': 'hsl(var(--ds-on-primary-container))',
        'ds-primary-fixed': 'hsl(var(--ds-primary-fixed))',
        'ds-primary-fixed-dim': 'hsl(var(--ds-primary-fixed-dim))',
        'ds-on-primary-fixed': 'hsl(var(--ds-on-primary-fixed))',
        'ds-secondary': 'hsl(var(--ds-secondary))',
        'ds-on-secondary': 'hsl(var(--ds-on-secondary))',
        'ds-secondary-container': 'hsl(var(--ds-secondary-container))',
        'ds-on-secondary-container': 'hsl(var(--ds-on-secondary-container))',
        'ds-secondary-fixed': 'hsl(var(--ds-secondary-fixed))',
        'ds-secondary-fixed-dim': 'hsl(var(--ds-secondary-fixed-dim))',
        'ds-tertiary': 'hsl(var(--ds-tertiary))',
        'ds-on-tertiary': 'hsl(var(--ds-on-tertiary))',
        'ds-tertiary-container': 'hsl(var(--ds-tertiary-container))',
        'ds-on-tertiary-container': 'hsl(var(--ds-on-tertiary-container))',
        'ds-tertiary-fixed': 'hsl(var(--ds-tertiary-fixed))',
        'ds-tertiary-fixed-dim': 'hsl(var(--ds-tertiary-fixed-dim))',
        'ds-on-background': 'hsl(var(--ds-on-background))',
        'ds-on-surface': 'hsl(var(--ds-on-surface))',
        'ds-on-surface-variant': 'hsl(var(--ds-on-surface-variant))',
        'ds-error': 'hsl(var(--ds-error))',
        'ds-on-error': 'hsl(var(--ds-on-error))',
        'ds-error-container': 'hsl(var(--ds-error-container))',
        'ds-on-error-container': 'hsl(var(--ds-on-error-container))',
        'ds-outline': 'hsl(var(--ds-outline))',
        'ds-outline-variant': 'hsl(var(--ds-outline-variant))',
        'ds-inverse-surface': 'hsl(var(--ds-inverse-surface))',
        'ds-inverse-on-surface': 'hsl(var(--ds-inverse-on-surface))',
        'ds-inverse-primary': 'hsl(var(--ds-inverse-primary))',
        'ds-shadow': 'hsl(var(--ds-shadow))',
        'ds-scrim': 'hsl(var(--ds-scrim))',
        'ds-warm-brown': 'hsl(var(--ds-warm-brown))',
        'ds-warm-brown-container': 'hsl(var(--ds-warm-brown-container))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        card: '1rem',
        button: '1.5rem',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        display: ['var(--font-display)', 'Manrope', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  plugins: [require('tailwindcss-animate')],
};

export default config;
