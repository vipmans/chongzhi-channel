<script setup lang="ts">
import { reactive, ref } from 'vue';
import { fetchRechargeChannel } from '@/service/api';

defineOptions({
  name: 'ChannelRechargeModal'
});

interface Props {
  channelId: string;
  channelName?: string;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'success'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const loading = ref(false);

const model = reactive({
  amount: 0,
  remark: ''
});

async function handleSubmit() {
  if (!props.channelId) {
    return;
  }

  if (!model.amount || model.amount <= 0) {
    window.$message?.warning('请输入大于 0 的充值金额');
    return;
  }

  if (!model.remark.trim()) {
    window.$message?.warning('请输入充值备注');
    return;
  }

  loading.value = true;

  const { error } = await fetchRechargeChannel(props.channelId, {
    amount: model.amount,
    remark: model.remark.trim()
  });

  loading.value = false;

  if (!error) {
    window.$message?.success('渠道充值已提交');
    model.amount = 0;
    model.remark = '';
    visible.value = false;
    emit('success');
  }
}
</script>

<template>
  <NModal
    v-model:show="visible"
    preset="card"
    :title="channelName ? `为 ${channelName} 充值` : '渠道充值'"
    class="w-520px lt-md:w-[95vw]"
    segmented
  >
    <NForm label-placement="left" label-width="90">
      <NFormItem label="充值金额">
        <NInputNumber v-model:value="model.amount" class="w-full" :min="0.01" :precision="2" placeholder="单位：元" />
      </NFormItem>
      <NFormItem label="充值备注">
        <NInput v-model:value="model.remark" type="textarea" :rows="4" placeholder="请输入本次充值备注" />
      </NFormItem>
    </NForm>
    <template #footer>
      <div class="flex justify-end gap-12px">
        <NButton @click="visible = false">取消</NButton>
        <NButton type="primary" :loading="loading" @click="handleSubmit">确认充值</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped></style>
