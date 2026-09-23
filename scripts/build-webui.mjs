// Builds janus-webui with VITE_API_BASE_URL='' so the bundle is same-origin
// (getApiBase() folds `?? 'http://127.0.0.1:8005'` away -> `return ""`).
//
// Why this file exists: neither PowerShell nor cmd.exe can hand a child process a
// PRESENT-but-EMPTY environment variable — `$env:X = ''` and `set X=` both DELETE the
// variable instead, which makes Vite fall back to the hardcoded http://127.0.0.1:8005
// base (caught by the same-origin guard in build-janus-exe.ps1). Node can set it
// programmatically (process.env.X = ''), so we spawn npm-cli.js from node with the
// variable injected. Keep in sync with package.json `build` in janus-webui.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const here = dirname(fileURLToPath(import.meta.url))
const webuiDir = join(here, '..', 'janus-webui')
const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')

if (!existsSync(join(webuiDir, 'package.json'))) {
  console.error(`janus-webui not found at ${webuiDir}`)
  process.exit(1)
}
if (!existsSync(npmCli)) {
  console.error(`npm-cli.js not found next to node at ${npmCli} (Node.js 20+ with npm required)`)
  process.exit(1)
}

const env = { ...process.env, VITE_API_BASE_URL: '' }
const res = spawnSync(process.execPath, [npmCli, 'run', 'build'], {
  cwd: webuiDir,
  env,
  stdio: 'inherit'
})
if (res.error) {
  console.error(res.error.message)
  process.exit(1)
}
process.exit(res.status === null ? 1 : res.status)
