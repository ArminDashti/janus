// Bundles scripts\janus-cli.ts for the SEA build via the esbuild JS API.
//
// Why this file exists: build-janus-exe.ps1 can only reach esbuild through
// node_modules\.bin\esbuild.cmd, and cmd.exe collapses the embedded quotes of
// --define:__JANUS_VERSION__="1.0.0" before esbuild parses it, so esbuild sees a
// bare `1.0.0` and rejects it ("must be an entity name or JS literal"). The JS API
// takes the literal from JSON.stringify with no shell in between.
// Same quoting-avoidance rationale as build-webui.mjs.
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const here = dirname(fileURLToPath(import.meta.url))
const apiDir = join(here, '..', 'janus-api')
const entry = join(here, 'janus-cli.ts')
const version = process.argv[2]
const outfile = process.argv[3]

if (!version) {
  console.error('usage: bundle-cli.mjs <version> <outfile>')
  process.exit(1)
}
if (!outfile) {
  console.error('missing <outfile> argument')
  process.exit(1)
}
if (!existsSync(entry)) {
  console.error(`entry not found: ${entry}`)
  process.exit(1)
}

const require = createRequire(join(apiDir, 'package.json'))
const esbuild = require('esbuild')

try {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    define: { __JANUS_VERSION__: JSON.stringify(version) },
    outfile,
    logLevel: 'warning'
  })
} catch {
  process.exit(1)
}
