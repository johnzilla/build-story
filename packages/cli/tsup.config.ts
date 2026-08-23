import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  // @buildstory/video and @buildstory/heygen are `dependencies`, which tsup
  // auto-externalizes — the render-time dynamic import()s resolve to the
  // installed workspace packages rather than being bundled into the CLI.
  banner: {
    js: '#!/usr/bin/env node',
  },
})
