import { defineConfig } from 'vitest/config';

// Library build: two ES entries sharing one chunk. `index` has no side effects,
// `define` registers <cursor-status>.
export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    lib: {
      entry: { index: 'src/index.ts', define: 'src/define.ts' },
      formats: ['es'],
    },
    rollupOptions: {
      output: { entryFileNames: '[name].js', chunkFileNames: '[name].js' },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
