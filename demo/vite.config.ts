import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The demo imports the package by name, exactly like a consumer would; the alias points it at src.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: process.env.DEMO_BASE ?? '/',
  resolve: {
    alias: { '@yuskraft/cursor-status': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
