// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { checkI18n } from './check-i18n.ts'

let root: string

function write(path: string, content: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

function run() {
  return checkI18n({
    srcDir: join(root, 'src'),
    localesDir: join(root, 'src', 'locales'),
  })
}

function messages() {
  return run().problems.map((problem) => problem.message)
}

const RU_COMMON = JSON.stringify({ app: { name: 'Имя', title: 'Заголовок' } })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'check-i18n-'))
  write('src/locales/ru/common.json', RU_COMMON)
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('checkI18n', () => {
  it('passes for existing literal keys in templates and scripts', () => {
    write(
      'src/Page.vue',
      `<script setup lang="ts">
const label = t('common.app.title')
</script>
<template><h1>{{ t('common.app.name') }}</h1><p>{{ label }}</p></template>`,
    )
    write('src/use.ts', `export const all = tm('common.app')\n`)

    expect(run()).toEqual({ problems: [], unusedKeys: [] })
  })

  it('reports a missing key with its file and line', () => {
    write('src/Page.vue', `<template>\n  <h1>{{ $t('common.app.missing') }}</h1>\n</template>`)

    const { problems } = run()

    expect(problems).toHaveLength(1)
    expect(problems[0]?.file).toContain('Page.vue')
    expect(problems[0]?.line).toBe(2)
    expect(problems[0]?.message).toBe('missing key "common.app.missing" in locale "ru"')
  })

  it('reports a missing <i18n-t> keypath and a branch key passed to t()', () => {
    write('src/Page.vue', `<template><i18n-t keypath="common.nope" tag="p" /></template>`)
    write('src/use.ts', `export const x = t('common.app')\n`)

    expect(messages()).toEqual([
      'missing key "common.nope" in locale "ru"',
      'missing key "common.app" in locale "ru"',
    ])
  })

  it('rejects non-literal keys unless they are marked', () => {
    write('src/use.ts', `export const a = (k: string) => t(k)\n`)
    write('src/marked.ts', `export const b = (k: string) => t(k) // i18n-dynamic-key: test\n`)

    expect(messages()).toEqual([
      't() needs a string-literal key (or a "i18n-dynamic-key" comment with a reason)',
    ])
  })

  it('does not treat other function names as translation calls', () => {
    write('src/use.ts', `format('x'); it('y'); set('z'); obj.at(0)\n`)

    expect(messages()).toEqual([])
  })

  it('reports raw Cyrillic text in templates and script literals but not in comments', () => {
    write(
      'src/Page.vue',
      `<script setup lang="ts">
// комментарий
const title = 'Привет'
</script>
<template>
  <!-- комментарий -->
  <p title="Подсказка">{{ t('common.app.name') }}</p>
</template>`,
    )
    write('src/use.ts', 'export const s = `Текст ${1}`\n')

    const { problems } = run()

    expect(problems.map((p) => [p.file.split(/[\\/]/).pop(), p.line, p.message])).toEqual([
      ['Page.vue', 3, 'raw Cyrillic text in a string literal; use a locale message'],
      ['Page.vue', 7, 'raw Cyrillic text in the template; use a locale message'],
      ['use.ts', 1, 'raw Cyrillic text in a string literal; use a locale message'],
    ])
  })

  it('skips test files and the locale directory', () => {
    write('src/Page.spec.ts', `t('common.missing'); const s = 'Привет'\n`)

    expect(messages()).toEqual([])
  })

  it('reports keys that differ between registered locales', () => {
    write('src/locales/en/common.json', JSON.stringify({ app: { name: 'Name', extra: 'Extra' } }))

    expect(messages()).toEqual([
      'locale "en" is missing key "common.app.title"',
      'locale "en" has key "common.app.extra" that "ru" does not define',
    ])
  })

  it('lists keys that are never used literally as warnings, not problems', () => {
    write('src/use.ts', `export const x = t('common.app.name')\n`)

    expect(run()).toEqual({ problems: [], unusedKeys: ['common.app.title'] })
  })
})
