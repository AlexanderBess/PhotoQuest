/**
 * i18n quality gate (PQ-004, ADR-024). Run with `pnpm i18n:check`.
 *
 * Fails when:
 * - a message key used in the source does not exist in the source locale (`ru`):
 *   literal first arguments of t / $t / te / $te / tm / $tm and `<i18n-t keypath="...">`;
 * - a key is not a string literal (it cannot be checked), unless the line carries
 *   the marker comment `i18n-dynamic-key` with a reason;
 * - a registered locale lacks keys of the source locale or has extra keys;
 * - Cyrillic text appears in a string literal of a `.ts` file or a `<script>` block,
 *   or anywhere in a `<template>` outside HTML comments (raw user-facing text).
 *
 * Keys defined in the locale files but not used literally are reported as warnings only.
 *
 * Locale layout: `<localesDir>/<locale>/<namespace>.json`; the file name is the first
 * key segment, exactly as `src/app/providers/i18n.ts` registers the messages.
 * Test files (`*.spec.ts`) are not scanned: they deliberately use missing keys.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { parse as parseSfc } from 'vue/compiler-sfc'

export const SOURCE_LOCALE = 'ru'
export const DYNAMIC_KEY_MARKER = 'i18n-dynamic-key'

export interface Problem {
  file: string
  line: number
  message: string
}

export interface CheckResult {
  problems: Problem[]
  unusedKeys: string[]
}

interface LocaleKeys {
  /** Keys whose value is a message string. */
  leaves: Set<string>
  /** Keys whose value is a nested object (valid for `tm`). */
  branches: Set<string>
}

const CYRILLIC = /[Ѐ-ӿ]/
/** Head of a translation call; the lookbehind rejects `format(`, `it(` and similar names. */
const KEY_CALL = /(?<![\w$])(\$?(?:tm|te|t))\s*\(\s*/g
const LITERAL_KEY = /^(['"])([^'"\\\n]*)\1|^`([^`$\\]*)`/
const KEYPATH_ATTR = /<i18n-t\b[^>]*?(:|v-bind:)?keypath\s*=\s*(["'])(.*?)\2/g
const HTML_COMMENT = /<!--[\s\S]*?-->/g

export function checkI18n(options: { srcDir: string; localesDir: string }): CheckResult {
  const { srcDir, localesDir } = options
  const problems: Problem[] = []
  const locales = loadLocales(localesDir, problems)
  const source = locales.get(SOURCE_LOCALE)
  if (!source) {
    problems.push({
      file: localesDir,
      line: 0,
      message: `source locale "${SOURCE_LOCALE}" not found`,
    })
    return { problems, unusedKeys: [] }
  }

  checkLocaleParity(locales, source, localesDir, problems)

  const usedKeys = new Set<string>()
  for (const file of listSourceFiles(srcDir, localesDir)) {
    const text = readFileSync(file, 'utf8')
    const name = relative(process.cwd(), file)
    checkKeyUsage(name, text, source, usedKeys, problems)
    if (file.endsWith('.vue')) {
      checkVueRawText(name, text, problems)
    } else {
      checkScriptRawText(name, text, 1, problems)
    }
  }

  const unusedKeys = [...source.leaves].filter((key) => !isUsed(key, usedKeys)).sort()
  return { problems, unusedKeys }
}

function loadLocales(localesDir: string, problems: Problem[]): Map<string, LocaleKeys> {
  const locales = new Map<string, LocaleKeys>()
  for (const locale of readdirSync(localesDir).sort()) {
    const dir = join(localesDir, locale)
    if (!statSync(dir).isDirectory()) {
      continue
    }
    const keys: LocaleKeys = { leaves: new Set(), branches: new Set() }
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith('.json')) {
        continue
      }
      const path = join(dir, file)
      let messages: unknown
      try {
        messages = JSON.parse(readFileSync(path, 'utf8'))
      } catch (error) {
        problems.push({ file: path, line: 0, message: `invalid JSON: ${String(error)}` })
        continue
      }
      collectKeys(basename(file, '.json'), messages, keys, path, problems)
    }
    locales.set(locale, keys)
  }
  return locales
}

function collectKeys(
  prefix: string,
  value: unknown,
  keys: LocaleKeys,
  file: string,
  problems: Problem[],
): void {
  if (typeof value === 'string') {
    keys.leaves.add(prefix)
    return
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    keys.branches.add(prefix)
    for (const [key, child] of Object.entries(value)) {
      collectKeys(`${prefix}.${key}`, child, keys, file, problems)
    }
    return
  }
  problems.push({ file, line: 0, message: `"${prefix}" must be a string or an object` })
}

function checkLocaleParity(
  locales: Map<string, LocaleKeys>,
  source: LocaleKeys,
  localesDir: string,
  problems: Problem[],
): void {
  for (const [locale, keys] of locales) {
    if (locale === SOURCE_LOCALE) {
      continue
    }
    const file = join(localesDir, locale)
    for (const key of source.leaves) {
      if (!keys.leaves.has(key)) {
        problems.push({ file, line: 0, message: `locale "${locale}" is missing key "${key}"` })
      }
    }
    for (const key of keys.leaves) {
      if (!source.leaves.has(key)) {
        problems.push({
          file,
          line: 0,
          message: `locale "${locale}" has key "${key}" that "${SOURCE_LOCALE}" does not define`,
        })
      }
    }
  }
}

function listSourceFiles(dir: string, excludeDir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry)
    if (resolve(path) === resolve(excludeDir)) {
      continue
    }
    if (statSync(path).isDirectory()) {
      files.push(...listSourceFiles(path, excludeDir))
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.vue')) &&
      !entry.endsWith('.spec.ts') &&
      !entry.endsWith('.d.ts')
    ) {
      files.push(path)
    }
  }
  return files
}

function checkKeyUsage(
  file: string,
  text: string,
  source: LocaleKeys,
  usedKeys: Set<string>,
  problems: Problem[],
): void {
  for (const match of text.matchAll(KEY_CALL)) {
    const fn = match[1] ?? ''
    const start = match.index + match[0].length
    const line = lineAt(text, match.index)
    const literal = LITERAL_KEY.exec(text.slice(start))
    if (!literal) {
      if (!lineText(text, match.index).includes(DYNAMIC_KEY_MARKER)) {
        problems.push({
          file,
          line,
          message: `${fn}() needs a string-literal key (or a "${DYNAMIC_KEY_MARKER}" comment with a reason)`,
        })
      }
      continue
    }
    const key = literal[2] ?? literal[3] ?? ''
    usedKeys.add(key)
    const allowBranch = fn.endsWith('tm')
    if (!source.leaves.has(key) && !(allowBranch && source.branches.has(key))) {
      problems.push({ file, line, message: `missing key "${key}" in locale "${SOURCE_LOCALE}"` })
    }
  }

  for (const match of text.matchAll(KEYPATH_ATTR)) {
    const line = lineAt(text, match.index)
    const key = match[3] ?? ''
    if (match[1]) {
      if (!lineText(text, match.index).includes(DYNAMIC_KEY_MARKER)) {
        problems.push({ file, line, message: `<i18n-t> needs a static keypath` })
      }
      continue
    }
    usedKeys.add(key)
    if (!source.leaves.has(key)) {
      problems.push({ file, line, message: `missing key "${key}" in locale "${SOURCE_LOCALE}"` })
    }
  }
}

function checkVueRawText(file: string, text: string, problems: Problem[]): void {
  const { descriptor } = parseSfc(text, { filename: file })
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (block) {
      checkScriptRawText(file, block.content, block.loc.start.line, problems)
    }
  }
  const template = descriptor.template
  if (template) {
    const content = template.content.replace(HTML_COMMENT, (comment) =>
      comment.replace(/[^\n]/g, ' '),
    )
    content.split('\n').forEach((lineContent, index) => {
      if (CYRILLIC.test(lineContent)) {
        problems.push({
          file,
          line: template.loc.start.line + index,
          message: 'raw Cyrillic text in the template; use a locale message',
        })
      }
    })
  }
}

function checkScriptRawText(
  file: string,
  code: string,
  firstLine: number,
  problems: Problem[],
): void {
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node): void => {
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)) &&
      CYRILLIC.test(node.text)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      problems.push({
        file,
        line: firstLine + line,
        message: 'raw Cyrillic text in a string literal; use a locale message',
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

function isUsed(key: string, usedKeys: Set<string>): boolean {
  for (const used of usedKeys) {
    if (key === used || key.startsWith(`${used}.`)) {
      return true
    }
  }
  return false
}

function lineAt(text: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 10) {
      line++
    }
  }
  return line
}

function lineText(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index) + 1
  const end = text.indexOf('\n', index)
  return text.slice(start, end === -1 ? undefined : end)
}

function main(): void {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const srcDir = join(root, 'src')
  const localesDir = join(srcDir, 'shared', 'i18n', 'locales')
  const { problems, unusedKeys } = checkI18n({ srcDir, localesDir })

  for (const key of unusedKeys) {
    console.warn(`warning: key "${key}" is not used literally in the source`)
  }
  for (const { file, line, message } of problems) {
    console.error(`${file}${line > 0 ? `:${line}` : ''}: ${message}`)
  }
  if (problems.length > 0) {
    console.error(`i18n check failed: ${problems.length} problem(s)`)
    process.exitCode = 1
    return
  }
  console.log('i18n check passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
