<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { NButton, NTag } from 'naive-ui';
import {
  fetchGetSupplierBalance,
  fetchGetSupplierConsumptionLogs,
  fetchGetSupplierDetail,
  fetchGetSupplierHealth,
  fetchGetSupplierProducts,
  fetchGetSupplierRechargeRecords,
  fetchGetSuppliers,
  fetchRefreshSupplierBalance
} from '@/service/api';
import { useNaivePaginatedTable } from '@/hooks/common/table';
import { formatDateTime, formatFen, getStatusTagType } from '@/utils/format';
import SupplierOperateModal from './modules/supplier-operate-modal.vue';
import SupplierRechargeModal from './modules/supplier-recharge-modal.vue';

defineOptions({
  name: 'SuppliersPage'
});

const searchModel = reactive({
  keyword: '',
  cooperationStatus: '',
  healthStatus: '',
  protocolType: ''
});

const productFilter = reactive({
  carrierCode: '',
  province: '',
  faceValue: null as number | null,
  status: ''
});

const consumptionFilter = reactive({
  mobile: '',
  orderNo: '',
  supplierOrderNo: ''
});

const consumptionDateRange = ref<[number, number] | null>(null);

const listQuery = reactive<Api.Supplier.QueryParams>({
  pageNum: 1,
  pageSize: 10
});

const selectedSupplierId = ref('');
const supplierDetail = ref<Api.Supplier.Detail | null>(null);
const supplierHealth = ref<Api.Supplier.Health | null>(null);
const supplierBalance = ref<Api.Supplier.Balance | null>(null);
const supplierProducts = ref<Api.Supplier.ProductItem[]>([]);
const supplierRechargeRecords = ref<Api.Supplier.RechargeRecord[]>([]);
const supplierConsumptionLogs = ref<Api.Supplier.ConsumptionLog[]>([]);
const detailLoading = ref(false);
const productsLoading = ref(false);
const recordsLoading = ref(false);
const consumptionLoading = ref(false);
const balanceRefreshing = ref(false);
const activeTab = ref<'info' | 'products' | 'balance' | 'records' | 'consumption'>('info');

const operateType = ref<NaiveUI.TableOperateType>('add');
const operateVisible = ref(false);
const rechargeVisible = ref(false);

const jsonModalVisible = ref(false);
const jsonModalTitle = ref('');
const jsonModalData = ref<unknown>(null);

const supplierTable = useNaivePaginatedTable({
  api: () =>
    fetchGetSuppliers({
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

const selectedSupplier = computed(() => supplierDetail.value);

watch(
  () => supplierTable.data.value,
  rows => {
    if (!rows.length) {
      selectedSupplierId.value = '';
      supplierDetail.value = null;
      supplierHealth.value = null;
      supplierBalance.value = null;
      supplierProducts.value = [];
      supplierRechargeRecords.value = [];
      supplierConsumptionLogs.value = [];
      return;
    }

    const exists = rows.some(item => item.supplierId === selectedSupplierId.value);

    if (!exists) {
      selectedSupplierId.value = rows[0].supplierId;
    }
  },
  { immediate: true }
);

watch(
  selectedSupplierId,
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
    if (!selectedSupplierId.value) {
      return;
    }

    if (tab === 'products') {
      await loadProducts();
    }

    if (tab === 'consumption') {
      await loadConsumptionLogs();
    }
  },
  { immediate: true }
);

async function loadOverview(supplierId: string) {
  detailLoading.value = true;
  recordsLoading.value = true;

  const [detailRes, healthRes, balanceRes, rechargeRes] = await Promise.all([
    fetchGetSupplierDetail(supplierId),
    fetchGetSupplierHealth(supplierId),
    fetchGetSupplierBalance(supplierId),
    fetchGetSupplierRechargeRecords(supplierId)
  ]);

  supplierDetail.value = detailRes.error ? null : detailRes.data;
  supplierHealth.value = healthRes.error ? null : healthRes.data;
  supplierBalance.value = balanceRes.error ? null : balanceRes.data;
  supplierRechargeRecords.value = rechargeRes.error ? [] : rechargeRes.data;

  detailLoading.value = false;
  recordsLoading.value = false;

  if (activeTab.value === 'products') {
    await loadProducts();
  }

  if (activeTab.value === 'consumption') {
    await loadConsumptionLogs();
  }
}

async function loadProducts() {
  if (!selectedSupplierId.value) {
    return;
  }

  productsLoading.value = true;

  const { data, error } = await fetchGetSupplierProducts(selectedSupplierId.value, cleanQuery(productFilter));

  supplierProducts.value = error ? [] : data;
  productsLoading.value = false;
}

async function loadConsumptionLogs() {
  if (!selectedSupplierId.value) {
    return;
  }

  consumptionLoading.value = true;

  const params = cleanQuery({
    ...consumptionFilter,
    startTime: consumptionDateRange.value ? dayjs(consumptionDateRange.value[0]).toISOString() : undefined,
    endTime: consumptionDateRange.value ? dayjs(consumptionDateRange.value[1]).toISOString() : undefined
  });

  const { data, error } = await fetchGetSupplierConsumptionLogs(selectedSupplierId.value, params);

  supplierConsumptionLogs.value = error ? [] : data;
  consumptionLoading.value = false;
}

async function refreshBalance() {
  if (!selectedSupplierId.value) {
    return;
  }

  balanceRefreshing.value = true;

  const { data, error } = await fetchRefreshSupplierBalance(selectedSupplierId.value);

  balanceRefreshing.value = false;

  if (!error) {
    supplierBalance.value = data;
    window.$message?.success('余额已刷新');
  }
}

function handleSearch() {
  supplierTable.getDataByPage(1);
}

function handleResetSearch() {
  Object.assign(searchModel, {
    keyword: '',
    cooperationStatus: '',
    healthStatus: '',
    protocolType: ''
  });

  supplierTable.getDataByPage(1);
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

function handleResetConsumptionFilter() {
  Object.assign(consumptionFilter, {
    mobile: '',
    orderNo: '',
    supplierOrderNo: ''
  });
  consumptionDateRange.value = null;
  loadConsumptionLogs();
}

function selectSupplier(supplierId: string) {
  selectedSupplierId.value = supplierId;
}

function handleAddSupplier() {
  operateType.value = 'add';
  operateVisible.value = true;
}

function handleEditSupplier(record?: Api.Supplier.Item | Api.Supplier.Detail | null) {
  const targetId = record ? ('supplierId' in record ? record.supplierId : '') : selectedSupplierId.value;

  if (!targetId) {
    return;
  }

  if (targetId !== selectedSupplierId.value) {
    selectedSupplierId.value = targetId;
  }

  operateType.value = 'edit';
  operateVisible.value = true;
}

function openJson(title: string, payload: unknown) {
  jsonModalTitle.value = title;
  jsonModalData.value = payload;
  jsonModalVisible.value = true;
}

function renderNullable(value?: string | null) {
  return value || '--';
}

function renderBoolean(value?: boolean) {
  return value ? '是' : '否';
}

function formatUnknown(value: unknown) {
  if (value === null || value === undefined) {
    return '--';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

function getColumns(): NaiveUI.TableColumn<Api.Supplier.Item>[] {
  return [
    {
      key: 'supplierCode',
      title: '供应商编码',
      width: 140
    },
    {
      key: 'supplierName',
      title: '供应商名称',
      minWidth: 180
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
      key: 'healthStatus',
      title: '健康状态',
      width: 120,
      render: row =>
        h(NTag, { type: getStatusTagType(row.healthStatus), bordered: false }, { default: () => row.healthStatus })
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
              onClick: () => selectSupplier(row.supplierId)
            },
            { default: () => '查看' }
          ),
          h(
            NButton,
            {
              text: true,
              type: 'primary',
              onClick: () => handleEditSupplier(row)
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
    <NCard :bordered="false" title="供应商筛选" class="card-wrapper">
      <NForm label-placement="left" label-width="76">
        <NGrid cols="1 s:2 m:4" :x-gap="16">
          <NGi>
            <NFormItem label="关键词">
              <NInput v-model:value="searchModel.keyword" placeholder="编码 / 名称 / 联系人" />
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
            <NFormItem label="健康状态">
              <NInput v-model:value="searchModel.healthStatus" placeholder="请输入健康状态" />
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
        <NCard :bordered="false" title="供应商列表" class="card-wrapper">
          <template #header-extra>
            <div class="flex gap-12px">
              <NButton @click="supplierTable.getData">
                <template #icon>
                  <icon-mdi-refresh class="text-icon" :class="{ 'animate-spin': supplierTable.loading }" />
                </template>
                刷新
              </NButton>
              <NButton type="primary" @click="handleAddSupplier">
                <template #icon>
                  <icon-ic-round-plus class="text-icon" />
                </template>
                新增供应商
              </NButton>
            </div>
          </template>
          <NDataTable
            :columns="supplierTable.columns.value"
            :data="supplierTable.data.value"
            :loading="supplierTable.loading.value"
            :pagination="supplierTable.mobilePagination.value"
            :row-key="row => row.supplierId"
            :row-props="
              row => ({
                style:
                  row.supplierId === selectedSupplierId
                    ? 'cursor:pointer;background-color: rgba(32, 128, 240, 0.08);'
                    : 'cursor:pointer;',
                onClick: () => selectSupplier(row.supplierId)
              })
            "
          />
        </NCard>
      </NGi>

      <NGi span="1 xl:14">
        <NCard :bordered="false" class="card-wrapper min-h-760px">
          <template #header>
            <div class="flex items-center gap-12px">
              <span>{{ selectedSupplier?.supplierName || '供应商详情' }}</span>
              <NTag v-if="selectedSupplier" type="primary" :bordered="false">{{ selectedSupplier.supplierCode }}</NTag>
            </div>
          </template>
          <template #header-extra>
            <div class="flex gap-12px">
              <NButton :disabled="!selectedSupplierId" @click="handleEditSupplier(selectedSupplier)">编辑信息</NButton>
              <NButton :disabled="!selectedSupplierId" :loading="balanceRefreshing" @click="refreshBalance">
                刷新余额
              </NButton>
              <NButton type="primary" :disabled="!selectedSupplierId" @click="rechargeVisible = true">
                新增充值记录
              </NButton>
            </div>
          </template>

          <NEmpty v-if="!selectedSupplierId" description="请先选择一个供应商" class="pt-80px" />

          <NTabs v-else v-model:value="activeTab" animated>
            <NTabPane name="info" tab="基本信息">
              <NSpin :show="detailLoading">
                <NSpace vertical :size="16">
                  <NDescriptions label-placement="left" bordered :column="2">
                    <NDescriptionsItem label="供应商编码">
                      {{ renderNullable(selectedSupplier?.supplierCode) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="协议类型">
                      {{ renderNullable(selectedSupplier?.protocolType) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="联系人">
                      {{ renderNullable(selectedSupplier?.contactName) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="联系电话">
                      {{ renderNullable(selectedSupplier?.contactPhone) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="联系邮箱">
                      {{ renderNullable(selectedSupplier?.contactEmail) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="认证模式">
                      {{ renderNullable(selectedSupplier?.credentialMode) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="接口地址" :span="2">
                      {{ renderNullable(selectedSupplier?.baseUrl) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="接入账号">
                      {{ renderNullable(selectedSupplier?.accessAccount) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="接入密码">
                      {{ renderNullable(selectedSupplier?.accessPassword) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="合作状态">
                      <NTag
                        v-if="selectedSupplier"
                        :type="getStatusTagType(selectedSupplier.cooperationStatus)"
                        :bordered="false"
                      >
                        {{ selectedSupplier.cooperationStatus }}
                      </NTag>
                      <template v-else>--</template>
                    </NDescriptionsItem>
                    <NDescriptionsItem label="余额查询">
                      {{ renderBoolean(selectedSupplier?.supportsBalanceQuery) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="充值记录">
                      {{ renderBoolean(selectedSupplier?.supportsRechargeRecords) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="消费日志">
                      {{ renderBoolean(selectedSupplier?.supportsConsumptionLog) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="最近健康检查">
                      {{ formatDateTime(selectedSupplier?.lastHealthCheckAt) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="创建时间">
                      {{ formatDateTime(selectedSupplier?.createdAt) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="更新时间">
                      {{ formatDateTime(selectedSupplier?.updatedAt) }}
                    </NDescriptionsItem>
                    <NDescriptionsItem label="备注" :span="2">
                      {{ renderNullable(selectedSupplier?.remark) }}
                    </NDescriptionsItem>
                  </NDescriptions>

                  <NCard size="small" title="健康状态">
                    <NDescriptions label-placement="left" :column="2">
                      <NDescriptionsItem label="健康状态">
                        <NTag
                          v-if="supplierHealth"
                          :type="getStatusTagType(supplierHealth.healthStatus)"
                          :bordered="false"
                        >
                          {{ supplierHealth.healthStatus }}
                        </NTag>
                        <template v-else>--</template>
                      </NDescriptionsItem>
                      <NDescriptionsItem label="HTTP 状态">{{ supplierHealth?.httpStatus ?? '--' }}</NDescriptionsItem>
                      <NDescriptionsItem label="最近成功">
                        {{ formatDateTime(supplierHealth?.lastSuccessAt) }}
                      </NDescriptionsItem>
                      <NDescriptionsItem label="最近失败">
                        {{ formatDateTime(supplierHealth?.lastFailureAt) }}
                      </NDescriptionsItem>
                      <NDescriptionsItem label="检查时间">
                        {{ formatDateTime(supplierHealth?.checkedAt) }}
                      </NDescriptionsItem>
                      <NDescriptionsItem label="状态说明">
                        {{ renderNullable(supplierHealth?.message) }}
                      </NDescriptionsItem>
                    </NDescriptions>
                  </NCard>
                </NSpace>
              </NSpin>
            </NTabPane>

            <NTabPane name="products" tab="产品快照">
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
                  :data="supplierProducts"
                  :columns="[
                    { key: 'supplierProductCode', title: '供应商商品编码', minWidth: 150 },
                    { key: 'productName', title: '产品名称', minWidth: 180 },
                    { key: 'carrierCode', title: '运营商', width: 110 },
                    { key: 'province', title: '省份', width: 100 },
                    { key: 'faceValueFen', title: '面值', width: 120, render: row => formatFen(row.faceValueFen) },
                    { key: 'costPriceFen', title: '成本价', width: 120, render: row => formatFen(row.costPriceFen) },
                    {
                      key: 'saleStatus',
                      title: '销售状态',
                      width: 110,
                      render: row =>
                        h(
                          NTag,
                          { type: getStatusTagType(row.saleStatus), bordered: false },
                          { default: () => row.saleStatus }
                        )
                    },
                    {
                      key: 'stockStatus',
                      title: '库存状态',
                      width: 110,
                      render: row =>
                        h(
                          NTag,
                          { type: getStatusTagType(row.stockStatus), bordered: false },
                          { default: () => row.stockStatus }
                        )
                    },
                    { key: 'arrivalSla', title: '到账 SLA', width: 120 },
                    {
                      key: 'rechargeRange',
                      title: '充值范围',
                      minWidth: 180,
                      render: row => formatUnknown(row.rechargeRange)
                    },
                    { key: 'updatedAt', title: '更新时间', width: 170, render: row => formatDateTime(row.updatedAt) },
                    {
                      key: 'rawPayload',
                      title: '原始报文',
                      width: 110,
                      render: row =>
                        h(
                          NButton,
                          {
                            text: true,
                            type: 'primary',
                            onClick: () => openJson('供应商产品原始报文', row.rawPayload)
                          },
                          { default: () => '查看' }
                        )
                    }
                  ]"
                  :scroll-x="1640"
                />
              </NSpace>
            </NTabPane>

            <NTabPane name="balance" tab="平台余额">
              <NSpin :show="detailLoading || balanceRefreshing">
                <NGrid cols="1 s:3" :x-gap="16" :y-gap="16">
                  <NGi>
                    <NCard size="small" title="当前余额">
                      <NStatistic
                        :value="supplierBalance?.balanceAmountFen ? supplierBalance.balanceAmountFen / 100 : 0"
                        suffix="元"
                      />
                    </NCard>
                  </NGi>
                  <NGi>
                    <NCard size="small" title="余额状态">
                      <div class="pt-10px">
                        <NTag
                          v-if="supplierBalance"
                          :type="getStatusTagType(supplierBalance.balanceStatus)"
                          :bordered="false"
                        >
                          {{ supplierBalance.balanceStatus }}
                        </NTag>
                        <span v-else>--</span>
                      </div>
                    </NCard>
                  </NGi>
                  <NGi>
                    <NCard size="small" title="数据来源">
                      <div class="pt-10px">
                        {{ renderNullable(supplierBalance?.sourceType) }}
                      </div>
                    </NCard>
                  </NGi>
                </NGrid>
                <NDescriptions class="mt-16px" label-placement="left" bordered :column="2">
                  <NDescriptionsItem label="币种">{{ renderNullable(supplierBalance?.currency) }}</NDescriptionsItem>
                  <NDescriptionsItem label="查询时间">
                    {{ formatDateTime(supplierBalance?.queriedAt) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="原始报文" :span="2">
                    <NButton
                      v-if="supplierBalance"
                      text
                      type="primary"
                      @click="openJson('供应商余额原始报文', supplierBalance.rawPayload)"
                    >
                      查看原始报文
                    </NButton>
                    <template v-else>--</template>
                  </NDescriptionsItem>
                </NDescriptions>
              </NSpin>
            </NTabPane>

            <NTabPane name="records" tab="充值记录">
              <NDataTable
                :loading="recordsLoading"
                :data="supplierRechargeRecords"
                :columns="[
                  { key: 'createdAt', title: '时间', width: 170, render: row => formatDateTime(row.createdAt) },
                  { key: 'rechargeType', title: '充值类型', width: 120 },
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
                  { key: 'recordSource', title: '来源', width: 110 },
                  {
                    key: 'status',
                    title: '状态',
                    width: 110,
                    render: row =>
                      h(NTag, { type: getStatusTagType(row.status), bordered: false }, { default: () => row.status })
                  },
                  {
                    key: 'supplierTradeNo',
                    title: '供应商流水',
                    minWidth: 140,
                    render: row => renderNullable(row.supplierTradeNo)
                  },
                  {
                    key: 'operatorUsername',
                    title: '操作人',
                    width: 120,
                    render: row => renderNullable(row.operatorUsername)
                  },
                  { key: 'remark', title: '备注', minWidth: 160, render: row => renderNullable(row.remark) },
                  {
                    key: 'rawPayload',
                    title: '原始报文',
                    width: 110,
                    render: row =>
                      h(
                        NButton,
                        {
                          text: true,
                          type: 'primary',
                          onClick: () => openJson('供应商充值记录原始报文', row.rawPayload)
                        },
                        { default: () => '查看' }
                      )
                  }
                ]"
                :scroll-x="1580"
              />
            </NTabPane>

            <NTabPane name="consumption" tab="消费日志">
              <NSpace vertical :size="16">
                <NForm label-placement="left" label-width="88">
                  <NGrid cols="1 s:2 xl:4" :x-gap="16">
                    <NGi>
                      <NFormItem label="手机号">
                        <NInput v-model:value="consumptionFilter.mobile" placeholder="mobile" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="平台订单号">
                        <NInput v-model:value="consumptionFilter.orderNo" placeholder="orderNo" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="供应商单号">
                        <NInput v-model:value="consumptionFilter.supplierOrderNo" placeholder="supplierOrderNo" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="时间范围">
                        <NDatePicker
                          v-model:value="consumptionDateRange"
                          class="w-full"
                          type="datetimerange"
                          clearable
                        />
                      </NFormItem>
                    </NGi>
                  </NGrid>
                </NForm>
                <div class="flex justify-end gap-12px">
                  <NButton @click="handleResetConsumptionFilter">重置</NButton>
                  <NButton type="primary" @click="loadConsumptionLogs">筛选</NButton>
                </div>
                <NDataTable
                  :loading="consumptionLoading"
                  :data="supplierConsumptionLogs"
                  :columns="[
                    { key: 'occurredAt', title: '发生时间', width: 170, render: row => formatDateTime(row.occurredAt) },
                    { key: 'mobile', title: '手机号', width: 130 },
                    { key: 'orderNo', title: '平台订单号', minWidth: 160, render: row => renderNullable(row.orderNo) },
                    {
                      key: 'supplierOrderNo',
                      title: '供应商订单号',
                      minWidth: 170,
                      render: row => renderNullable(row.supplierOrderNo)
                    },
                    { key: 'amountFen', title: '金额', width: 120, render: row => formatFen(row.amountFen) },
                    {
                      key: 'status',
                      title: '状态',
                      width: 110,
                      render: row =>
                        h(NTag, { type: getStatusTagType(row.status), bordered: false }, { default: () => row.status })
                    },
                    {
                      key: 'rawPayload',
                      title: '原始报文',
                      width: 110,
                      render: row =>
                        h(
                          NButton,
                          {
                            text: true,
                            type: 'primary',
                            onClick: () => openJson('供应商消费日志原始报文', row.rawPayload)
                          },
                          { default: () => '查看' }
                        )
                    }
                  ]"
                  :scroll-x="1120"
                />
              </NSpace>
            </NTabPane>
          </NTabs>
        </NCard>
      </NGi>
    </NGrid>

    <SupplierOperateModal
      v-model:visible="operateVisible"
      :operate-type="operateType"
      :editing-data="selectedSupplier"
      @success="() => supplierTable.getData()"
    />

    <SupplierRechargeModal
      v-model:visible="rechargeVisible"
      :supplier-id="selectedSupplierId"
      :supplier-name="selectedSupplier?.supplierName"
      @success="loadOverview(selectedSupplierId)"
    />

    <JsonModal v-model:visible="jsonModalVisible" :title="jsonModalTitle" :data="jsonModalData" />
  </NSpace>
</template>

<style scoped></style>
