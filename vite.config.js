import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // En Windows el observador de archivos a veces no ve los cambios: sondeo explícito.
  // /api va al servidor CleanDose de producción. Para usar uno local: CLEANDOSE_API=http://localhost:8080 pnpm dev
  server: {
    watch: { usePolling: true, interval: 250 },
    proxy: { '/api': process.env.CLEANDOSE_API ?? 'http://149.130.170.232:8080' },
  },
});
