import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // En Windows el observador de archivos a veces no ve los cambios: sondeo explícito.
  server: { watch: { usePolling: true, interval: 250 } },
});
