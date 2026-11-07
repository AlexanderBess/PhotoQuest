import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import ruCommon from './locales/ru/common.json'
import { ruPluralRule } from './plural'

const { t } = createI18n({
  legacy: false,
  locale: 'ru',
  messages: { ru: { common: ruCommon } },
  pluralRules: { ru: ruPluralRule },
}).global

describe('Russian plural forms', () => {
  it.each([1, 21, 101])('%d uses "фотография" (one)', (count) => {
    expect(t('common.photos.count', count)).toBe(`${count} фотография`)
  })

  it.each([2, 4, 22])('%d uses "фотографии" (few)', (count) => {
    expect(t('common.photos.count', count)).toBe(`${count} фотографии`)
  })

  it.each([0, 5, 11, 12, 14, 25, 111])('%d uses "фотографий" (many)', (count) => {
    expect(t('common.photos.count', count)).toBe(`${count} фотографий`)
  })

  it('1.5 uses "фотографии" (other), displayed with a locale-formatted number', () => {
    const formatted = new Intl.NumberFormat('ru').format(1.5)

    expect(t('common.photos.count', { n: formatted }, 1.5)).toBe('1,5 фотографии')
  })
})

describe('ruPluralRule', () => {
  it('stays within the forms a message provides', () => {
    expect(ruPluralRule(5, 2)).toBe(1)
  })

  it('treats negative counts like positive ones', () => {
    expect(ruPluralRule(-1, 4)).toBe(0)
  })
})
