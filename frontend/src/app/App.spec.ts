import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import App from './App.vue'
import { createAppI18n } from './providers/i18n'
import { createAppRouter } from './router'

async function mountAt(path: string) {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  return mount(App, { global: { plugins: [createAppI18n(), router] } })
}

describe('application shell', () => {
  it('renders the home page from the ru messages', async () => {
    const wrapper = await mountAt('/')

    expect(wrapper.get('h1').text()).toBe('PhotoQuest')
    expect(wrapper.text()).toContain('Смотрите, где и как сделаны отличные фотографии')
  })

  it('renders the Russian not-found page for an unknown route', async () => {
    const wrapper = await mountAt('/no-such-page')

    expect(wrapper.get('h1').text()).toBe('Страница не найдена')
    expect(wrapper.get('a').attributes('href')).toBe('/')
    expect(wrapper.get('a').text()).toBe('На главную')
  })
})
