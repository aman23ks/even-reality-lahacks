import { defineConfig } from 'vite'

export default defineConfig({
  // Even Hub apps are single-page apps served from the phone WebView.
  // The base path is relative so the built files work inside the .ehpk package.
  base: './',
  
  server: {
    // Use 0.0.0.0 so the QR sideload can reach your laptop from the phone.
    host: '0.0.0.0',
    port: 5173,
  },

  build: {
    // Output to dist/ — this is what `evenhub pack` packages into the .ehpk.
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      input: { main: 'index.html', mirror: 'mirror.html' },
    },
  },
})
