<script setup lang="ts">
import { computed } from 'vue';
import { stringifyJson } from '@/utils/format';

defineOptions({
  name: 'JsonModal'
});

interface Props {
  title?: string;
  data?: unknown;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'JSON',
  data: undefined
});

const visible = defineModel<boolean>('visible', {
  default: false
});

const code = computed(() => stringifyJson(props.data));
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="title" class="w-860px lt-md:w-[95vw]" segmented>
    <NCode :code="code" language="json" word-wrap />
  </NModal>
</template>

<style scoped></style>
