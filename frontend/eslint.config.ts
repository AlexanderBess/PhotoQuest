import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import { globalIgnores } from 'eslint/config'
import pluginVue from 'eslint-plugin-vue'
import type { ConfigArray } from 'typescript-eslint'

const config: ConfigArray = defineConfigWithVueTs(
  globalIgnores(['dist/**', 'coverage/**']),
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    rules: {
      'vue/no-bare-strings-in-template': 'error',
    },
  },
  skipFormatting,
)

export default config
