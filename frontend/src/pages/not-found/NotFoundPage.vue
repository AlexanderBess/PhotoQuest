<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <main class="not-found-page">
    <h1>{{ t('common.notFound.title') }}</h1>
    <p>{{ t('common.notFound.description') }}</p>
    <RouterLink :to="{ name: 'home' }">{{ t('common.notFound.backHome') }}</RouterLink>
  </main>
</template>

<style scoped>
.not-found-page {
  padding: 2rem 1rem;
}
</style>
