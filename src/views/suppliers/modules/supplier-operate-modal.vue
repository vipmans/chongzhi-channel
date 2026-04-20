<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { fetchCreateSupplier, fetchUpdateSupplier } from '@/service/api';
import { useNaiveForm } from '@/hooks/common/form';

defineOptions({
  name: 'SupplierOperateModal'
});

interface Props {
  operateType: NaiveUI.TableOperateType;
  editingData?: Api.Supplier.Detail | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'success'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { formRef } = useNaiveForm();
const loading = ref(false);

const model = reactive<Api.Supplier.EntityForm>(createDefaultModel());

const rules = computed<Record<string, App.Global.FormRule[]>>(() => ({
  supplierName: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
  protocolType: [{ required: true, message: '请输入协议类型', trigger: 'blur' }]
}));

const title = computed(() => (props.operateType === 'add' ? '新增供应商' : '编辑供应商'));

watch(
  () => [visible.value, props.editingData, props.operateType],
  () => {
    if (!visible.value) {
      return;
    }

    Object.assign(model, createDefaultModel());

    if (props.operateType === 'edit' && props.editingData) {
      Object.assign(model, {
        supplierCode: props.editingData.supplierCode,
        supplierName: props.editingData.supplierName,
        contactName: props.editingData.contactName || '',
        contactPhone: props.editingData.contactPhone || '',
        contactEmail: props.editingData.contactEmail || '',
        baseUrl: props.editingData.baseUrl || '',
        protocolType: props.editingData.protocolType,
        credentialMode: props.editingData.credentialMode,
        accessAccount: props.editingData.accessAccount || '',
        accessPassword: props.editingData.accessPassword || '',
        cooperationStatus: props.editingData.cooperationStatus,
        supportsBalanceQuery: props.editingData.supportsBalanceQuery,
        supportsRechargeRecords: props.editingData.supportsRechargeRecords,
        supportsConsumptionLog: props.editingData.supportsConsumptionLog,
        remark: props.editingData.remark || '',
        healthStatus: props.editingData.healthStatus,
        status: props.editingData.status || ''
      });
    }
  },
  { immediate: true }
);

async function handleSubmit() {
  await formRef.value?.validate();

  loading.value = true;

  const payload = sanitizeSupplierForm(model);

  const { error } =
    props.operateType === 'add' || !props.editingData
      ? await fetchCreateSupplier(payload)
      : await fetchUpdateSupplier(props.editingData.supplierId, payload);

  loading.value = false;

  if (!error) {
    window.$message?.success(props.operateType === 'add' ? '供应商新增成功' : '供应商更新成功');
    visible.value = false;
    emit('success');
  }
}

function createDefaultModel(): Api.Supplier.EntityForm {
  return {
    supplierCode: '',
    supplierName: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    baseUrl: '',
    protocolType: '',
    credentialMode: '',
    accessAccount: '',
    accessPassword: '',
    cooperationStatus: '',
    supportsBalanceQuery: false,
    supportsRechargeRecords: false,
    supportsConsumptionLog: false,
    remark: '',
    healthStatus: '',
    status: ''
  };
}

function sanitizeSupplierForm(form: Api.Supplier.EntityForm): Api.Supplier.EntityForm {
  return {
    supplierCode: form.supplierCode?.trim() || undefined,
    supplierName: form.supplierName.trim(),
    contactName: form.contactName?.trim() || undefined,
    contactPhone: form.contactPhone?.trim() || undefined,
    contactEmail: form.contactEmail?.trim() || undefined,
    baseUrl: form.baseUrl?.trim() || undefined,
    protocolType: form.protocolType.trim(),
    credentialMode: form.credentialMode?.trim() || undefined,
    accessAccount: form.accessAccount?.trim() || undefined,
    accessPassword: form.accessPassword?.trim() || undefined,
    cooperationStatus: form.cooperationStatus?.trim() || undefined,
    supportsBalanceQuery: Boolean(form.supportsBalanceQuery),
    supportsRechargeRecords: Boolean(form.supportsRechargeRecords),
    supportsConsumptionLog: Boolean(form.supportsConsumptionLog),
    remark: form.remark?.trim() || undefined,
    healthStatus: form.healthStatus?.trim() || undefined,
    status: form.status?.trim() || undefined
  };
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="title" class="w-760px lt-md:w-[95vw]" segmented>
    <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" label-width="100">
      <NGrid cols="1 s:2" :x-gap="16">
        <NGi>
          <NFormItem label="供应商编码" path="supplierCode">
            <NInput v-model:value="model.supplierCode" placeholder="请输入供应商编码" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="供应商名称" path="supplierName">
            <NInput v-model:value="model.supplierName" placeholder="请输入供应商名称" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="联系人" path="contactName">
            <NInput v-model:value="model.contactName" placeholder="请输入联系人" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="联系电话" path="contactPhone">
            <NInput v-model:value="model.contactPhone" placeholder="请输入联系电话" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="联系邮箱" path="contactEmail">
            <NInput v-model:value="model.contactEmail" placeholder="请输入联系邮箱" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="协议类型" path="protocolType">
            <NInput v-model:value="model.protocolType" placeholder="例如 http / https / soap" />
          </NFormItem>
        </NGi>
        <NGi span="2">
          <NFormItem label="接口地址" path="baseUrl">
            <NInput v-model:value="model.baseUrl" placeholder="请输入接口地址" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="认证模式" path="credentialMode">
            <NInput v-model:value="model.credentialMode" placeholder="请输入认证模式" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="合作状态" path="cooperationStatus">
            <NInput v-model:value="model.cooperationStatus" placeholder="请输入合作状态" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="接入账号" path="accessAccount">
            <NInput v-model:value="model.accessAccount" placeholder="请输入接入账号" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="接入密码" path="accessPassword">
            <NInput
              v-model:value="model.accessPassword"
              type="password"
              show-password-on="click"
              placeholder="请输入接入密码"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="健康状态" path="healthStatus">
            <NInput v-model:value="model.healthStatus" placeholder="请输入健康状态" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="状态" path="status">
            <NInput v-model:value="model.status" placeholder="请输入状态" />
          </NFormItem>
        </NGi>
        <NGi span="2">
          <NFormItem label="余额查询">
            <NSwitch v-model:value="model.supportsBalanceQuery" />
          </NFormItem>
        </NGi>
        <NGi span="2">
          <NFormItem label="充值记录">
            <NSwitch v-model:value="model.supportsRechargeRecords" />
          </NFormItem>
        </NGi>
        <NGi span="2">
          <NFormItem label="消费日志">
            <NSwitch v-model:value="model.supportsConsumptionLog" />
          </NFormItem>
        </NGi>
        <NGi span="2">
          <NFormItem label="备注" path="remark">
            <NInput v-model:value="model.remark" type="textarea" :rows="3" placeholder="请输入备注" />
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
