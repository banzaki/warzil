import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Local development: the online API runs in "wrangler dev" on port 8787.
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8787', ws: true },
    },
  },
});
