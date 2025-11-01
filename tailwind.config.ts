import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#005cbb',
          50: '#e6f0ff',
          100: '#cfe2ff',
          200: '#abc7ff',
          500: '#005cbb'
        },
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e'
        },
        orange: {
          500: '#f97316',
          600: '#ea580c'
        }
      },
      fontFamily: {
        mont: ['Montserrat', 'sans-serif']
      },
      boxShadow: {
        level1: '0px 12px 24px -4px rgba(145, 158, 171, .3)',
        level2: 'rgba(145, 158, 171, .12) 0px 1px 16px',
        level3: '0px 12px 24px -4px rgba(145, 158, 171, .3)'
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '28px'
      }
    }
  },
  plugins: []
}

export default config


