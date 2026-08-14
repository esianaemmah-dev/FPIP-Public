import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Vite config for the FPIP React SPA.
// Local dev runs on port 5173 to match the redirect URI registered for
// the `FPIP-Web-SPA` Entra ID app registration (see /entra/README.md).
export default defineConfig(({ mode }) => ({
  plugins: react(),
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    // Do not publish readable application source maps from production builds.
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@azure/msal-')) return 'identity';
          if (id.includes('/node_modules/react') || id.includes('/node_modules/react-router')) return 'react';
          return undefined;
        },
      },
    },
  },
}));
