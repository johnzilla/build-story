import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['remotion', '@remotion/renderer', '@remotion/bundler', 'react', 'react-dom'],
})
