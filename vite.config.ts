import { defineConfig, transformWithEsbuild, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { buildFeedPrefetchConfig } from './src/prefetch/feedPrefetchShared'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

const PREFETCH_SOURCE = fileURLToPath(new URL('./src/prefetch/feedPrefetch.inline.ts', import.meta.url))

/**
 * Starts the first feed page request from index.html, in parallel with the app
 * bundle download, and warms connections to the other hosts the first render
 * needs. See src/prefetch/feedPrefetch.inline.ts.
 */
function feedPrefetchPlugin(): Plugin {
  return {
    name: 'feed-prefetch',
    async transformIndexHtml() {
      const { code } = await transformWithEsbuild(
        readFileSync(PREFETCH_SOURCE, 'utf-8'),
        PREFETCH_SOURCE,
        {
          loader: 'ts',
          format: 'iife',
          minify: true,
          target: 'es2019',
          define: { __FEED_PREFETCH_CONFIG__: JSON.stringify(buildFeedPrefetchConfig()) },
        },
      )
      return [
        // Images (profile avatars, token icons, NFT media). Plain <img> loads use
        // the non-CORS connection pool, hence no crossorigin attribute.
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://api.universalprofile.cloud' }, injectTo: 'head' },
        // Address resolution and the Stakingverse explorer supplement (CORS fetches).
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://feed.api.universalprofile.cloud', crossorigin: '' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://explorer.execution.mainnet.lukso.network', crossorigin: '' }, injectTo: 'head' },
        // Injected at the end of <body>, after the GitHub Pages `_spa_redirect`
        // pickup script, so it reads the restored deep-link path.
        { tag: 'script', children: code.trim(), injectTo: 'body' },
      ]
    },
  }
}

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('lukso-'),
        },
      },
    }),
    feedPrefetchPlugin(),
  ],
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://dev.auth-simple.pages.dev',
        changeOrigin: true,
      },
    },
  },
})
