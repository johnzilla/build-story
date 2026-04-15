import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  // @buildstory/heygen is lazily installed at runtime -- mark external so the
  // dynamic import is preserved in the bundle rather than bundled or erroring.
  external: ['@buildstory/heygen'],
  banner: {
    js: '#!/usr/bin/env node',
  },
})
