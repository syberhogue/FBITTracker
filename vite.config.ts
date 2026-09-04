import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('react-router') || id.includes('@tanstack')) return 'app-vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    exclude: ['tests/e2e/**', 'node_modules/**'],
    css: true,
  },
});
