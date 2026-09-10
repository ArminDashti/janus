import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      },
      includeAssets: ['branding/*.png', 'icons/*.png', 'logos/*.svg'],
      manifest: {
        name: 'Janus',
        short_name: 'Janus',
        description: 'Manage Skills, Rules, MCPs, Hooks, Sub-agents, and Tools across AI platforms',
        theme_color: '#1E1E1E',
        background_color: '#1E1E1E',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  server: {
    port: 8006,
    host: '127.0.0.1'
  },
  preview: {
    port: 8006,
    host: '127.0.0.1'
  }
})
