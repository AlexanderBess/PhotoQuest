<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <main class="home-page">
    <h1>{{ t('common.app.name') }}</h1>
    <p>{{ t('common.app.tagline') }}</p>
  </main>
</template>

<style scoped>
.home-page {
  padding: 2rem 1rem;
}
</style>
