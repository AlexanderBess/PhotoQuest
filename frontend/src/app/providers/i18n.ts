import { createI18n } from 'vue-i18n'

import ruCommon from '@/shared/i18n/locales/ru/common.json'
import { ruPluralRule } from '@/shared/i18n/plural'

/** A missing key is a bug: it throws in development and tests, and shows the key in production. */
function failOnMissingKey(locale: string, key: string): void {
  if (import.meta.env.DEV) {
    throw new Error(`Missing i18n key "${key}" for locale "${locale}"`)
  }
}

export function createAppI18n() {
  return createI18n({
    legacy: false,
    locale: 'ru',
    fallbackLocale: 'ru',
    messages: { ru: { common: ruCommon } },
    pluralRules: { ru: ruPluralRule },
    missing: failOnMissingKey,
  })
}
