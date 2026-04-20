<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue';
import { NButton, NTag } from 'naive-ui';
import {
  fetchGetChannelBalance,
  fetchGetChannelDetail,
  fetchGetChannelProducts,
  fetchGetChannelRechargeRecords,
  fetchGetChannels
} from '@/service/api';
import { useNaivePaginatedTable } from '@/hooks/common/table';
import { formatDateTime, formatFen, getStatusTagType } from '@/utils/format';
import ChannelOperateModal from './modules/channel-operate-modal.vue';
import ChannelRechargeModal from './modules/channel-recharge-modal.vue';

defineOptions({
  name: 'ChannelsPage'
});

const searchModel = reactive({
  keyword: '',
  status: '',
  cooperationStatus: '',
  protocolType: '',
  channelType: ''
});

const productFilter = reactive({
  carrierCode: '',
  province: '',
  faceValue: null as number | null,
  status: ''
});

const listQuery = reactive<Api.Channel.QueryParams>({
  pageNum: 1,
  pageSize: 10
});

const selectedChannelId = ref('');
const channelDetail = ref<Api.Channel.Detail | null>(null);
const channelBalance = ref<Api.Channel.Balance | null>(null);
const channelProducts = ref<Api.Channel.ProductItem[]>([]);
const channelRechargeRecords = ref<Api.Channel.RechargeRecord[]>([]);
const detailLoading = ref(false);
const productsLoading = ref(false);
const recordsLoading = ref(false);
const activeTab = ref<'info' | 'products' | 'balance' | 'records'>('info');

const operateType = ref<NaiveUI.TableOperateType>('add');
const operateVisible = ref(false);
const rechargeVisible = ref(false);

const channelTable = useNaivePaginatedTable({
  api: () =>
    fetchGetChannels({
      ...listQuery,
      ...cleanQuery(searchModel)
    }),
  columns: getColumns,
  transform: response => {
    if (response.error) {
      return {
        data: [],
        pageNum: listQuery.pageNum,
        pageSize: listQuery.pageSize,
        total: 0
      };
    }

    return {
      data: response.data.records,
      pageNum: response.data.pageNum,
      pageSize: response.data.pageSize,
      total: response.data.total
    };
  },
  onPaginationParamsChange: ({ page, pageSize }) => {
    listQuery.pageNum = page || 1;
    listQuery.pageSize = pageSize || 10;
  }
});

const selectedChannel = computed(() => channelDetail.value);

watch(
  () => channelTable.data.value,
  rows => {
    if (!rows.length) {
      selectedChannelId.value = '';
      channelDetail.value = null;
      channelBalance.value = null;
      channelProducts.value = [];
      channelRechargeRecords.value = [];
      return;
    }

    const exists = rows.some(item => item.id === selectedChannelId.value);

    if (!exists) {
      selectedChannelId.value = rows[0].id;
    }
  },
  { immediate: true }
);

watch(
  selectedChannelId,
  async id => {
    if (!id) {
      return;
    }

    await loadOverview(id);
  },
  { immediate: true }
);

watch(
  () => activeTab.value,
  async tab => {
    if (!selectedChannelId.value) {
      return;
    }

    if (tab === 'products') {
      await loadProducts();
    }
  },
  { immediate: true }
);

async function loadOverview(channelId: string) {
  detailLoading.value = true;
  recordsLoading.value = true;

  const [detailRes, balanceRes, rechargeRes] = await Promise.all([
    fetchGetChannelDetail(channelId),
    fetchGetChannelBalance(channelId),
    fetchGetChannelRechargeRecords(channelId)
  ]);

  channelDetail.value = detailRes.error ? null : detailRes.data;
  channelBalance.value = balanceRes.error ? null : balanceRes.data;
  channelRechargeRecords.value = rechargeRes.error ? [] : rechargeRes.data;

  detailLoading.value = false;
  recordsLoading.value = false;

  if (activeTab.value === 'products') {
    await loadProducts();
  }
}

async function loadProducts() {
  if (!selectedChannelId.value) {
    return;
  }

  productsLoading.value = true;

  const { data, error } = await fetchGetChannelProducts(selectedChannelId.value, cleanQuery(productFilter));

  channelProducts.value = error ? [] : data;
  productsLoading.value = false;
}

function handleSearch() {
  channelTable.getDataByPage(1);
}

function handleResetSearch() {
  Object.assign(searchModel, {
    keyword: '',
    status: '',
    cooperationStatus: '',
    protocolType: '',
    channelType: ''
  });

  channelTable.getDataByPage(1);
}

function handleResetProductFilter() {
  Object.assign(productFilter, {
    carrierCode: '',
    province: '',
    faceValue: null,
    status: ''
  });

  loadProducts();
}

function selectChannel(channelId: string) {
  selectedChannelId.value = channelId;
}

function handleAddChannel() {
  operateType.value = 'add';
  operateVisible.value = true;
}

function handleEditChannel(record?: Api.Channel.Item | Api.Channel.Detail | null) {
  const targetId = record ? ('id' in record ? record.id : '') : selectedChannelId.value;

  if (!targetId) {
    return;
  }

  if (targetId !== selectedChannelId.value) {
    selectedChannelId.value = targetId;
  }

  operateType.value = 'edit';
  operateVisible.value = true;
}

function renderNullable(value?: string | null) {
  return value || '--';
}

function renderBoolean(value?: boolean) {
  return value ? '是' : '否';
}

function getColumns(): NaiveUI.TableColumn<Api.Channel.Item>[] {
  return [
    {
      key: 'channelCode',
      title: '渠道编码',
      width: 140
    },
    {
      key: 'channelName',
      title: '渠道名称',
      minWidth: 180
    },
    {
      key: 'channelType',
      title: '渠道类型',
      width: 120
    },
    {
      key: 'protocolType',
      title: '协议',
      width: 120
    },
    {
      key: 'cooperationStatus',
      title: '合作状态',
      width: 120,
      render: row =>
        h(
          NTag,
          { type: getStatusTagType(row.cooperationStatus), bordered: false },
          { default: () => row.cooperationStatus }
        )
    },
    {
      key: 'status',
      title: '状态',
      width: 110,
      render: row => h(NTag, { type: getStatusTagType(row.status), bordered: false }, { default: () => row.status })
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      width: 170,
      render: row => formatDateTime(row.updatedAt)
    },
    {
      key: 'actions',
      title: '操作',
      width: 150,
      fixed: 'right',
      render: row =>
        h('div', { class: 'flex items-center gap-8px' }, [
          h(
            NButton,
            {
              text: true,
              type: 'primary',
              onClick: () => selectChannel(row.id)
            },
            { default: () => '查看' }
          ),
          h(
            NButton,
            {
              text: true,
              type: 'primary',
              onClick: () => handleEditChannel(row)
            },
            { default: () => '编辑' }
          )
        ])
    }
  ];
}

function cleanQuery<T extends Record<string, unknown>>(query: T) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  ) as Partial<T>;
}
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" title="渠道筛选" class="card-wrapper">
      <NForm label-placement="left" label-width="76">
        <NGrid cols="1 s:2 m:3 l:5" :x-gap="16">
          <NGi>
            <NFormItem label="关键词">
              <NInput v-model:value="searchModel.keyword" placeholder="编码 / 名称 / 联系人" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="渠道类型">
              <NInput v-model:value="searchModel.channelType" placeholder="请输入渠道类型" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="协议类型">
              <NInput v-model:value="searchModel.protocolType" placeholder="请输入协议类型" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="合作状态">
              <NInput v-model:value="searchModel.cooperationStatus" placeholder="请输入合作状态" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="状态">
              <NInput v-model:value="searchModel.status" placeholder="请输入状态" />
            </NFormItem>
          </NGi>
        </NGrid>
      </NForm>
      <div class="flex justify-end gap-12px">
        <NButton @click="handleResetSearch">重置</NButton>
        <NButton type="primary" @click="handleSearch">查询</NButton>
      </div>
    </NCard>

    <NGrid cols="1 xl:24" :x-gap="16" :y-gap="16">
      <NGi span="1 xl:10">
        <NCard :bordered="false" title="渠道列表" class="card-wrapper">
          <template #header-extra>
            <div class="flex gap-12px">
              <NButton @click="channelTable.getData">
                <template #icon>
                  <icon-mdi-refresh class="text-icon" :class="{ 'animate-spin': channelTable.loading }" />
                </template>
                刷新
              </NButton>
              <NButton type="primary" @click="handleAddChannel">
                <template #icon>
                  <icon-ic-round-plus class="text-icon" />
                </template>
                新增渠道
              </NButton>
            </div>
          </template>
          <NDataTable
            :columns="channelTable.columns.value"
            :data="channelTable.data.value"
            :loading="channelTable.loading.value"
            :pagination="channelTable.mobilePagination.value"
            :row-key="row => row.id"
            :row-props="
              row => ({
                style:
                  row.id === selectedChannelId
                    ? 'cursor:pointer;background-color: rgba(24, 160, 88, 0.08);'
                    : 'cursor:pointer;',
                onClick: () => selectChannel(row.id)
              })
            "
          />
        </NCard>
      </NGi>

      <NGi span="1 xl:14">
        <NCard :bordered="false" class="card-wrapper min-h-720px">
          <template #header>
            <div class="flex items-center gap-12px">
              <span>{{ selectedChannel?.channelName || '渠道详情' }}</span>
              <NTag v-if="selectedChannel" type="primary" :bordered="false">{{ selectedChannel.channelCode }}</NTag>
            </div>
          </template>
          <template #header-extra>
            <div class="flex gap-12px">
              <NButton :disabled="!selectedChannelId" @click="handleEditChannel(selectedChannel)">编辑信息</NButton>
              <NButton type="primary" :disabled="!selectedChannelId" @click="rechargeVisible = true">渠道充值</NButton>
            </div>
          </template>

          <NEmpty v-if="!selectedChannelId" description="请先选择一个渠道" class="pt-80px" />

          <NTabs v-else v-model:value="activeTab" animated>
            <NTabPane name="info" tab="基本信息">
              <NSpin :show="detailLoading">
                <NDescriptions label-placement="left" bordered :column="2">
                  <NDescriptionsItem label="渠道编码">
                    {{ renderNullable(selectedChannel?.channelCode) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="渠道类型">
                    {{ renderNullable(selectedChannel?.channelType) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="联系人">
                    {{ renderNullable(selectedChannel?.contactName) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="联系电话">
                    {{ renderNullable(selectedChannel?.contactPhone) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="联系邮箱">
                    {{ renderNullable(selectedChannel?.contactEmail) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="协议类型">
                    {{ renderNullable(selectedChannel?.protocolType) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="接口地址" :span="2">
                    {{ renderNullable(selectedChannel?.baseUrl) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="接入账号">
                    {{ renderNullable(selectedChannel?.accessAccount) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="接入密码">
                    {{ renderNullable(selectedChannel?.accessPassword) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="合作状态">
                    <NTag
                      v-if="selectedChannel"
                      :type="getStatusTagType(selectedChannel.cooperationStatus)"
                      :bordered="false"
                    >
                      {{ selectedChannel.cooperationStatus }}
                    </NTag>
                    <template v-else>--</template>
                  </NDescriptionsItem>
                  <NDescriptionsItem label="消费日志">
                    {{ renderBoolean(selectedChannel?.supportsConsumptionLog) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="结算模式">
                    {{ renderNullable(selectedChannel?.settlementMode) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="系统状态">
                    <NTag v-if="selectedChannel" :type="getStatusTagType(selectedChannel.status)" :bordered="false">
                      {{ selectedChannel.status }}
                    </NTag>
                    <template v-else>--</template>
                  </NDescriptionsItem>
                  <NDescriptionsItem label="创建时间">
                    {{ formatDateTime(selectedChannel?.createdAt) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="更新时间">
                    {{ formatDateTime(selectedChannel?.updatedAt) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="备注" :span="2">
                    {{ renderNullable(selectedChannel?.remark) }}
                  </NDescriptionsItem>
                </NDescriptions>
              </NSpin>
            </NTabPane>

            <NTabPane name="products" tab="产品列表">
              <NSpace vertical :size="16">
                <NForm label-placement="left" label-width="76">
                  <NGrid cols="1 s:2 xl:4" :x-gap="16">
                    <NGi>
                      <NFormItem label="运营商">
                        <NInput v-model:value="productFilter.carrierCode" placeholder="carrierCode" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="省份">
                        <NInput v-model:value="productFilter.province" placeholder="province" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="面值">
                        <NInputNumber v-model:value="productFilter.faceValue" class="w-full" :min="1" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="状态">
                        <NInput v-model:value="productFilter.status" placeholder="status" />
                      </NFormItem>
                    </NGi>
                  </NGrid>
                </NForm>
                <div class="flex justify-end gap-12px">
                  <NButton @click="handleResetProductFilter">重置</NButton>
                  <NButton type="primary" @click="loadProducts">筛选</NButton>
                </div>
                <NDataTable
                  :loading="productsLoading"
                  :data="channelProducts"
                  :columns="[
                    { key: 'productName', title: '产品名称', minWidth: 180 },
                    { key: 'carrierCode', title: '运营商', width: 110 },
                    { key: 'province', title: '省份', width: 100 },
                    { key: 'faceValueFen', title: '面值', width: 120, render: row => formatFen(row.faceValueFen) },
                    { key: 'salePriceFen', title: '销售价', width: 120, render: row => formatFen(row.salePriceFen) },
                    { key: 'authorized', title: '已授权', width: 90, render: row => (row.authorized ? '是' : '否') },
                    {
                      key: 'routeSupplierName',
                      title: '路由供应商',
                      minWidth: 140,
                      render: row => renderNullable(row.routeSupplierName)
                    },
                    {
                      key: 'latestSnapshotAt',
                      title: '最新快照',
                      width: 170,
                      render: row => formatDateTime(row.latestSnapshotAt)
                    },
                    {
                      key: 'status',
                      title: '状态',
                      width: 110,
                      render: row =>
                        h(NTag, { type: getStatusTagType(row.status), bordered: false }, { default: () => row.status })
                    }
                  ]"
                  :scroll-x="1180"
                />
              </NSpace>
            </NTabPane>

            <NTabPane name="balance" tab="平台余额">
              <NSpin :show="detailLoading">
                <NGrid cols="1 s:3" :x-gap="16" :y-gap="16">
                  <NGi>
                    <NCard size="small" title="可用余额">
                      <NStatistic
                        :value="channelBalance?.availableBalanceFen ? channelBalance.availableBalanceFen / 100 : 0"
                        suffix="元"
                      />
                    </NCard>
                  </NGi>
                  <NGi>
                    <NCard size="small" title="冻结余额">
                      <NStatistic
                        :value="channelBalance?.frozenBalanceFen ? channelBalance.frozenBalanceFen / 100 : 0"
                        suffix="元"
                      />
                    </NCard>
                  </NGi>
                  <NGi>
                    <NCard size="small" title="余额状态">
                      <div class="pt-10px">
                        <NTag v-if="channelBalance" :type="getStatusTagType(channelBalance.status)" :bordered="false">
                          {{ channelBalance.status }}
                        </NTag>
                        <span v-else>--</span>
                      </div>
                    </NCard>
                  </NGi>
                </NGrid>
                <NDescriptions class="mt-16px" label-placement="left" bordered :column="2">
                  <NDescriptionsItem label="币种">{{ renderNullable(channelBalance?.currency) }}</NDescriptionsItem>
                  <NDescriptionsItem label="更新时间">
                    {{ formatDateTime(channelBalance?.updatedAt) }}
                  </NDescriptionsItem>
                </NDescriptions>
              </NSpin>
            </NTabPane>

            <NTabPane name="records" tab="充值记录">
              <NDataTable
                :loading="recordsLoading"
                :data="channelRechargeRecords"
                :columns="[
                  { key: 'createdAt', title: '时间', width: 170, render: row => formatDateTime(row.createdAt) },
                  {
                    key: 'amountFen',
                    title: '充值金额',
                    width: 120,
                    render: row => formatFen(row.amountFen, row.currency)
                  },
                  {
                    key: 'beforeBalanceFen',
                    title: '充值前',
                    width: 120,
                    render: row => formatFen(row.beforeBalanceFen, row.currency)
                  },
                  {
                    key: 'afterBalanceFen',
                    title: '充值后',
                    width: 120,
                    render: row => formatFen(row.afterBalanceFen, row.currency)
                  },
                  { key: 'recordSource', title: '来源', width: 120 },
                  {
                    key: 'operatorUsername',
                    title: '操作人',
                    width: 120,
                    render: row => renderNullable(row.operatorUsername)
                  },
                  { key: 'remark', title: '备注', minWidth: 180, render: row => renderNullable(row.remark) }
                ]"
                :scroll-x="980"
              />
            </NTabPane>
          </NTabs>
        </NCard>
      </NGi>
    </NGrid>

    <ChannelOperateModal
      v-model:visible="operateVisible"
      :operate-type="operateType"
      :editing-data="selectedChannel"
      @success="() => channelTable.getData()"
    />

    <ChannelRechargeModal
      v-model:visible="rechargeVisible"
      :channel-id="selectedChannelId"
      :channel-name="selectedChannel?.channelName"
      @success="loadOverview(selectedChannelId)"
    />
  </NSpace>
</template>

<style scoped></style>
