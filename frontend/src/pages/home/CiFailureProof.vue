<script setup lang="ts">
// Deliberate failure for the PQ-004 CI proof (branch ci-failure-proof only; never merge).
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <p>{{ t('common.ciFailureProof.missingKey') }}</p>
</template>
