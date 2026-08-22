import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // `composite: true` (set in tsconfig for the cli→core project reference) makes
  // tsup's DTS pass fail with TS6307 under TS 6.x. The DTS build is a plain
  // single-program compile, not a `tsc -b` graph, so it doesn't need composite.
  dts: { compilerOptions: { composite: false } },
  clean: true,
  sourcemap: true,
})
