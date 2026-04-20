<script setup lang="ts">
import { reactive, ref } from 'vue';
import { fetchCreateSupplierRechargeRecord } from '@/service/api';
import { yuanToFen } from '@/utils/format';

defineOptions({
  name: 'SupplierRechargeModal'
});

interface Props {
  supplierId: string;
  supplierName?: string;
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
  rechargeType: 'manual',
  amountYuan: 0,
  currency: 'CNY',
  beforeBalanceYuan: null as number | null,
  afterBalanceYuan: null as number | null,
  recordSource: 'manual',
  supplierTradeNo: '',
  remark: '',
  rawPayloadText: '',
  status: 'success'
});

async function handleSubmit() {
  if (!props.supplierId) {
    return;
  }

  if (!model.rechargeType.trim()) {
    window.$message?.warning('请输入充值类型');
    return;
  }

  if (!model.recordSource.trim()) {
    window.$message?.warning('请输入记录来源');
    return;
  }

  const amountFen = yuanToFen(model.amountYuan);

  if (amountFen <= 0) {
    window.$message?.warning('请输入大于 0 的充值金额');
    return;
  }

  let rawPayload: Record<string, unknown> | undefined;

  if (model.rawPayloadText.trim()) {
    try {
      rawPayload = JSON.parse(model.rawPayloadText) as Record<string, unknown>;
    } catch {
      window.$message?.error('原始报文必须是合法 JSON');
      return;
    }
  }

  loading.value = true;

  const { error } = await fetchCreateSupplierRechargeRecord(props.supplierId, {
    rechargeType: model.rechargeType.trim(),
    amountFen,
    currency: model.currency.trim() || 'CNY',
    beforeBalanceFen:
      model.beforeBalanceYuan === null || model.beforeBalanceYuan === undefined
        ? undefined
        : yuanToFen(model.beforeBalanceYuan),
    afterBalanceFen:
      model.afterBalanceYuan === null || model.afterBalanceYuan === undefined
        ? undefined
        : yuanToFen(model.afterBalanceYuan),
    recordSource: model.recordSource.trim(),
    supplierTradeNo: model.supplierTradeNo.trim() || undefined,
    remark: model.remark.trim() || undefined,
    rawPayload,
    status: model.status.trim() || undefined
  });

  loading.value = false;

  if (!error) {
    window.$message?.success('供应商充值记录已新增');
    resetForm();
    visible.value = false;
    emit('success');
  }
}

function resetForm() {
  model.rechargeType = 'manual';
  model.amountYuan = 0;
  model.currency = 'CNY';
  model.beforeBalanceYuan = null;
  model.afterBalanceYuan = null;
  model.recordSource = 'manual';
  model.supplierTradeNo = '';
  model.remark = '';
  model.rawPayloadText = '';
  model.status = 'success';
}
</script>

<template>
  <NModal
    v-model:show="visible"
    preset="card"
    :title="supplierName ? `新增 ${supplierName} 充值记录` : '新增供应商充值记录'"
    class="w-680px lt-md:w-[95vw]"
    segmented
  >
    <NForm label-placement="left" label-width="110">
      <NGrid cols="1 s:2" :x-gap="16">
        <NGi>
          <NFormItem label="充值类型">
            <NInput v-model:value="model.rechargeType" placeholder="如 manual / transfer" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="记录来源">
            <NInput v-model:value="model.recordSource" placeholder="如 manual / api" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="充值金额">
            <NInputNumber
              v-model:value="model.amountYuan"
              class="w-full"
              :min="0.01"
              :precision="2"
              placeholder="单位：元"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="币种">
            <NInput v-model:value="model.currency" placeholder="默认 CNY" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="充值前余额">
            <NInputNumber
              v-model:value="model.beforeBalanceYuan"
              class="w-full"
              :min="0"
              :precision="2"
              placeholder="可选，单位：元"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="充值后余额">
            <NInputNumber
              v-model:value="model.afterBalanceYuan"
              class="w-full"
              :min="0"
              :precision="2"
              placeholder="可选，单位：元"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="供应商流水号">
            <NInput v-model:value="model.supplierTradeNo" placeholder="可选" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="状态">
            <NInput v-model:value="model.status" placeholder="如 success / pending" />
          </NFormItem>
        </NGi>
        <NGi span="2">
          <NFormItem label="备注">
            <NInput v-model:value="model.remark" type="textarea" :rows="3" placeholder="请输入备注" />
          </NFormItem>
        </NGi>
        <NGi span="2">
          <NFormItem label="原始报文">
            <NInput
              v-model:value="model.rawPayloadText"
              type="textarea"
              :rows="6"
              placeholder="可选，输入 JSON，例如 {&quot;source&quot;:&quot;manual&quot;}"
            />
          </NFormItem>
        </NGi>
      </NGrid>
    </NForm>
    <template #footer>
      <div class="flex justify-end gap-12px">
        <NButton @click="visible = false">取消</NButton>
        <NButton type="primary" :loading="loading" @click="handleSubmit">保存</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped></style>
