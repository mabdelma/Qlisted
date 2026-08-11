import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-router')) return 'vendor-router';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) return 'vendor-react';
          if (id.includes('node_modules/@sentry')) return 'vendor-sentry';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          if (id.includes('node_modules/@stripe')) return 'vendor-stripe';
          if (id.includes('node_modules/@dnd-kit')) return 'vendor-dnd';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourceMapsUploadOptions: {
        include: ['./dist'],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Qlisted — Hospitality OS',
        short_name: 'Qlisted',
        description: 'The AI-native operating system for hospitality: ordering, payments, operations, and guests, for restaurants and hotels.',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['food', 'business', 'productivity', 'travel'],
        lang: 'en',
        dir: 'ltr',
        prefer_related_applications: false,
        icons: [
          { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/offline.html',
        navigateFallbackAllowlist: [/^\/r\//, /^\/$/],
        importScripts: ['push-handler.js'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/r\/.*\/menu/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'menu-cache', expiration: { maxEntries: 50, maxAgeSeconds: 600 } },
          },
          {
            urlPattern: /^\/api\/tenants/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tenant-cache', expiration: { maxEntries: 50, maxAgeSeconds: 600 } },
          },
          {
            urlPattern: /^\/api\/r\/.*\/tables/,
            handler: 'NetworkFirst',
            options: { cacheName: 'table-cache', expiration: { maxEntries: 20, maxAgeSeconds: 120 } },
          },
          {
            urlPattern: /^\/api\/r\/.*\/orders/,
            handler: 'NetworkFirst',
            options: { cacheName: 'order-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
          },
          {
            urlPattern: /^\/api\/r\/.*\/payments/,
            handler: 'NetworkFirst',
            options: { cacheName: 'payment-cache', expiration: { maxEntries: 30, maxAgeSeconds: 300 } },
          },
          {
            urlPattern: /^\/api\/r\/.*\/checkout/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'image-cache', expiration: { maxEntries: 100, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
