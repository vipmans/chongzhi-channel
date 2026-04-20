<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { fetchCreateChannel, fetchUpdateChannel } from '@/service/api';
import { useNaiveForm } from '@/hooks/common/form';

defineOptions({
  name: 'ChannelOperateModal'
});

interface Props {
  operateType: NaiveUI.TableOperateType;
  editingData?: Api.Channel.Detail | null;
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

const model = reactive<Api.Channel.EntityForm>(createDefaultModel());

const rules = computed<Record<string, App.Global.FormRule[]>>(() => ({
  channelCode: [{ required: true, message: '请输入渠道编码', trigger: 'blur' }],
  channelName: [{ required: true, message: '请输入渠道名称', trigger: 'blur' }],
  channelType: [{ required: true, message: '请输入渠道类型', trigger: 'blur' }]
}));

const title = computed(() => (props.operateType === 'add' ? '新增渠道' : '编辑渠道'));

watch(
  () => [visible.value, props.editingData, props.operateType],
  () => {
    if (!visible.value) {
      return;
    }

    Object.assign(model, createDefaultModel());

    if (props.operateType === 'edit' && props.editingData) {
      Object.assign(model, {
        channelCode: props.editingData.channelCode,
        channelName: props.editingData.channelName,
        channelType: props.editingData.channelType,
        contactName: props.editingData.contactName || '',
        contactPhone: props.editingData.contactPhone || '',
        contactEmail: props.editingData.contactEmail || '',
        baseUrl: props.editingData.baseUrl || '',
        protocolType: props.editingData.protocolType || '',
        accessAccount: props.editingData.accessAccount || '',
        accessPassword: props.editingData.accessPassword || '',
        cooperationStatus: props.editingData.cooperationStatus || '',
        supportsConsumptionLog: props.editingData.supportsConsumptionLog,
        settlementMode: props.editingData.settlementMode || '',
        status: props.editingData.status || '',
        remark: props.editingData.remark || ''
      });
    }
  },
  { immediate: true }
);

async function handleSubmit() {
  await formRef.value?.validate();

  loading.value = true;

  const payload = sanitizeChannelForm(model);

  const { error } =
    props.operateType === 'add' || !props.editingData
      ? await fetchCreateChannel(payload)
      : await fetchUpdateChannel(props.editingData.id, payload);

  loading.value = false;

  if (!error) {
    window.$message?.success(props.operateType === 'add' ? '渠道新增成功' : '渠道更新成功');
    visible.value = false;
    emit('success');
  }
}

function createDefaultModel(): Api.Channel.EntityForm {
  return {
    channelCode: '',
    channelName: '',
    channelType: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    baseUrl: '',
    protocolType: '',
    accessAccount: '',
    accessPassword: '',
    cooperationStatus: '',
    supportsConsumptionLog: false,
    settlementMode: '',
    status: '',
    remark: ''
  };
}

function sanitizeChannelForm(form: Api.Channel.EntityForm): Api.Channel.EntityForm {
  return {
    channelCode: form.channelCode.trim(),
    channelName: form.channelName.trim(),
    channelType: form.channelType.trim(),
    contactName: form.contactName?.trim() || undefined,
    contactPhone: form.contactPhone?.trim() || undefined,
    contactEmail: form.contactEmail?.trim() || undefined,
    baseUrl: form.baseUrl?.trim() || undefined,
    protocolType: form.protocolType?.trim() || undefined,
    accessAccount: form.accessAccount?.trim() || undefined,
    accessPassword: form.accessPassword?.trim() || undefined,
    cooperationStatus: form.cooperationStatus?.trim() || undefined,
    supportsConsumptionLog: Boolean(form.supportsConsumptionLog),
    settlementMode: form.settlementMode?.trim() || undefined,
    status: form.status?.trim() || undefined,
    remark: form.remark?.trim() || undefined
  };
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="title" class="w-720px lt-md:w-[95vw]" segmented>
    <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" label-width="100">
      <NGrid cols="1 s:2" :x-gap="16">
        <NGi>
          <NFormItem label="渠道编码" path="channelCode">
            <NInput v-model:value="model.channelCode" placeholder="请输入渠道编码" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="渠道名称" path="channelName">
            <NInput v-model:value="model.channelName" placeholder="请输入渠道名称" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="渠道类型" path="channelType">
            <NInput v-model:value="model.channelType" placeholder="请输入渠道类型" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="协议类型" path="protocolType">
            <NInput v-model:value="model.protocolType" placeholder="例如 http / https / bearer" />
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
          <NFormItem label="合作状态" path="cooperationStatus">
            <NInput v-model:value="model.cooperationStatus" placeholder="请输入合作状态" />
          </NFormItem>
        </NGi>
        <NGi span="2">
          <NFormItem label="接口地址" path="baseUrl">
            <NInput v-model:value="model.baseUrl" placeholder="请输入接口地址" />
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
          <NFormItem label="结算模式" path="settlementMode">
            <NInput v-model:value="model.settlementMode" placeholder="请输入结算模式" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="状态" path="status">
            <NInput v-model:value="model.status" placeholder="请输入状态" />
          </NFormItem>
        </NGi>
        <NGi span="2">
          <NFormItem label="消费日志" path="supportsConsumptionLog">
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
