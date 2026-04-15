import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'

export async function detectVideoPackage(): Promise<boolean> {
  try {
    await import('@buildstory/video')
    return true
  } catch {
    return false
  }
}

async function askYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() !== 'n')
    })
  })
}

export async function ensureVideoPackage(): Promise<void> {
  const installed = await detectVideoPackage()
  if (installed) return

  const proceed = await askYesNo(
    'Video rendering requires ~200MB of dependencies. Install now? [Y/n] ',
  )
  if (!proceed) {
    console.log('Skipping video install. Use --skip-video for text-only output.')
    process.exit(0)
  }

  console.log('Installing @buildstory/video dependencies...')
  const result = spawnSync('pnpm', ['install', '--filter', '@buildstory/video'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  if (result.status !== 0) {
    console.error('Failed to install video dependencies.')
    process.exit(1)
  }
}

export async function detectHeyGenPackage(): Promise<boolean> {
  try {
    await import('@buildstory/heygen')
    return true
  } catch {
    return false
  }
}

export async function ensureHeyGenPackage(): Promise<void> {
  const installed = await detectHeyGenPackage()
  if (installed) return

  const proceed = await askYesNo(
    'HeyGen renderer requires installing @buildstory/heygen. Install now? [Y/n] ',
  )
  if (!proceed) {
    console.log('Skipping HeyGen install.')
    process.exit(0)
  }

  console.log('Installing @buildstory/heygen...')
  const result = spawnSync('pnpm', ['install', '--filter', '@buildstory/heygen'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  if (result.status !== 0) {
    console.error('Failed to install @buildstory/heygen.')
    process.exit(1)
  }
}
