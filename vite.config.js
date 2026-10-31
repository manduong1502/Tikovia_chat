import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

// Plugin tự động dọn sạch thư mục dist trước mỗi lần build để tránh vite-plugin-pwa (injectManifest) cộng dồn các chunk cũ
function cleanDistBeforeBuild() {
  let cleaned = false
  return {
    name: 'clean-dist-before-build',
    enforce: 'pre',
    config(_, { command }) {
      if (command === 'build' && !cleaned) {
        cleaned = true
        const distDir = path.resolve(process.cwd(), 'dist')
        if (fs.existsSync(distDir)) {
          fs.rmSync(distDir, { recursive: true, force: true })
        }
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    cleanDistBeforeBuild(),
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'ChatTikovia - Chat Nội bộ Doanh nghiệp',
        short_name: 'ChatTikovia',
        description: 'Ứng dụng chat nội bộ bảo mật cao cho doanh nghiệp',
        theme_color: '#0766ff',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-socket': ['socket.io-client'],
          'vendor-peerjs': ['peerjs'],
          'vendor-icons': ['react-icons/fi']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true
  }
})
