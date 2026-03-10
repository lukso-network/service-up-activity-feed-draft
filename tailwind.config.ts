import type { Config } from 'tailwindcss'

// LUKSO design system neutral palette
// Source: @lukso/web-components tailwind-config
const luksoNeutral = {
  50: '#f8fafb',   // neutral-98
  100: '#f5f8fa',  // neutral-97
  200: '#eef3f6',  // neutral-95
  300: '#dee7ed',  // neutral-90
  400: '#bdcedb',  // neutral-80
  500: '#9cb6c9',  // neutral-70
  600: '#7a9db8',  // neutral-60
  700: '#476a85',  // neutral-40
  800: '#1b2832',  // neutral-15
  900: '#121b21',  // neutral-10
  950: '#0d1419',  // darker than neutral-10 for deepest bg
}

export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neutral: luksoNeutral,
        lukso: {
          pink: '#FE005B',
          magenta: '#D4004C',
          light: '#FFF0F5',
          dark: '#121b21',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
