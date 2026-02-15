import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        lukso: {
          pink: '#FE005B',
          magenta: '#D4004C',
          light: '#FFF0F5',
          dark: '#1A1A2E',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
