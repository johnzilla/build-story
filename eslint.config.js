import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    files: ['packages/*/src/**/*.ts'],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['fs', 'fs/*', 'node:fs', 'node:fs/*'],
            message: '@buildstory/core must not import fs. Pass file contents as arguments.',
          },
          {
            group: ['path', 'node:path'],
            message: '@buildstory/core must not import path. Use typed options.',
          },
          {
            group: ['process', 'node:process'],
            message: '@buildstory/core must not import process. Pass env values via typed options.',
          },
          {
            group: ['smol-toml', '@iarna/toml', 'toml', 'js-toml'],
            message: '@buildstory/core must not parse config files. Config is loaded by the CLI wrapper.',
          },
        ],
      }],
      'no-restricted-globals': ['error',
        { name: 'process', message: 'Do not access process in @buildstory/core. Pass values via typed options.' },
      ],
    },
  }
)
