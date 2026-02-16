import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('lukso-'),
        },
      },
    }),
  ],
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
