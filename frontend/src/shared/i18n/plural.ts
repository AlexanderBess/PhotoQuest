const russianRules = new Intl.PluralRules('ru')

/**
 * Picks the message form for Russian. Messages list the CLDR categories in the
 * order one | few | many | other; fractions fall into `other`.
 */
export function ruPluralRule(choice: number, choicesLength: number): number {
  return Math.min(formIndex(russianRules.select(Math.abs(choice))), choicesLength - 1)
}

function formIndex(category: Intl.LDMLPluralRule): number {
  switch (category) {
    case 'one':
      return 0
    case 'few':
      return 1
    case 'many':
      return 2
    default:
      return 3
  }
}
