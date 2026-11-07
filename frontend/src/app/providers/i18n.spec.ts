import { describe, expect, it } from 'vitest'

import { createAppI18n } from './i18n'

describe('createAppI18n', () => {
  it('uses Russian as the default and the fallback locale', () => {
    const { locale, fallbackLocale } = createAppI18n().global

    expect(locale.value).toBe('ru')
    expect(fallbackLocale.value).toBe('ru')
  })

  it('resolves a key from the ru messages', () => {
    expect(createAppI18n().global.t('common.notFound.title')).toBe('Страница не найдена')
  })

  it('throws on a missing key', () => {
    expect(() => createAppI18n().global.t('common.noSuchKey')).toThrow(
      'Missing i18n key "common.noSuchKey"',
    )
  })
})
