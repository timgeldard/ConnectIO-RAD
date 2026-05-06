import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO_ROOT = new URL('..', import.meta.url)
const FRONTEND_DIRS = [
  'apps/envmon/frontend/src',
  'apps/spc/frontend/src',
  'apps/trace2/frontend/src',
  'apps/warehouse360/frontend/src',
  'apps/processorderhistory/frontend/src',
  'apps/connectedquality/frontend/src',
  'apps/platform/frontend/src',
  'libs/shared-ui/src',
]

const strict = process.argv.includes('--strict')
const files = []

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch (e) {
    return // Skip missing directories
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      if (entry === 'dist' || entry === 'node_modules' || entry === '__tests__') continue
      walk(fullPath)
      continue
    }

    if (!/\.(js|jsx|ts|tsx|css|scss)$/.test(entry)) continue
    files.push(fullPath)
  }
}

for (const feDir of FRONTEND_DIRS) {
  walk(new URL(feDir, REPO_ROOT).pathname)
}

const checks = [
  {
    name: 'IBM Carbon Design System imports (DEPRECATED)',
    match: code => /@carbon\//.test(code),
    strict: true
  },
  {
    name: 'Tailwind utility usage (FORBIDDEN)',
    match: code => /className\s*=\s*["'`{][^]*?\b(?:bg-|text-|border-|rounded|shadow|px-|py-|mx-|my-|flex|grid|gap-|justify-|items-|min-h-|h-\[|h-|w-\[|w-|dark:|sm:|md:|lg:|xl:|sticky|top-|left-|right-|bottom-)/m.test(code),
    strict: false
  },
]

const results = checks.map(check => ({
  ...check,
  files: files
    .filter(file => {
      try {
        return check.match(readFileSync(file, 'utf8'))
      } catch (e) {
        return false
      }
    })
    .map(file => relative(REPO_ROOT.pathname, file)),
}))

let totalViolations = 0
let strictViolations = 0
console.log('--- Frontend Design System Audit ---')
for (const result of results) {
  console.log(`\n${result.name}: ${result.files.length}`)
  for (const file of result.files.slice(0, 20)) {
    console.log(`  - ${file}`)
  }
  if (result.files.length > 20) {
    console.log(`  ... ${result.files.length - 20} more`)
  }
  totalViolations += result.files.length
  if (result.strict) strictViolations += result.files.length
}

if (strict && strictViolations > 0) {
  console.error(`\nFAILED: Found ${strictViolations} strict violations (Carbon).`)
  process.exit(1)
} else if (totalViolations > 0) {
  console.warn(`\nWARNING: Found ${totalViolations} potential regressions.`)
} else {
  console.log('\nPASSED: No design system violations found.')
}
