// Enforces the ARCHITECTURE.md dependency rule: model, jobs, report, apply
// are pure and never import render, ui, services, or app.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PURE_MODULES = ['model', 'jobs', 'report', 'apply']
const FORBIDDEN = ['render', 'ui', 'services', 'app']
const SRC = join(import.meta.dirname, '.')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

describe('dependency rule', () => {
  for (const moduleName of PURE_MODULES) {
    it(`${moduleName}/ imports no ui, render, services or app code`, () => {
      for (const file of sourceFiles(join(SRC, moduleName))) {
        const code = readFileSync(file, 'utf8')
        const imports = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
        for (const spec of imports) {
          const violates = FORBIDDEN.some(
            (f) => spec.includes(`/${f}/`) || spec.endsWith(`/${f}`),
          )
          expect(violates, `${file} imports ${spec}`).toBe(false)
        }
      }
    })
  }
})
