
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This makes process.env.API_KEY available in the client-side code
    // Vite automatically loads .env files and exposes variables starting with VITE_
    // However, for compatibility with @google/genai, we explicitly define process.env.API_KEY
    // Assuming API_KEY will be provided directly in the environment where Vite is built/served.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  resolve: {
    alias: {
      '@': '/src', // If you start using an /src directory for aliases
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0', // This is the crucial line to add/update
    open: true,
    port: 3000,
  },
  preview: { // Also add host for the preview server used by `npm run preview`
    host: '0.0.0.0',
    port: 3000,
  }
});