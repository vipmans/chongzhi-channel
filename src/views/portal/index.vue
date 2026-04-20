<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { NButton, NTag, type PaginationProps } from 'naive-ui';
import {
  fetchCreatePortalBatchOrders,
  fetchCreatePortalOrder,
  fetchGetPortalChannelBalance,
  fetchGetPortalChannelProfile,
  fetchGetPortalChannelQuota,
  fetchGetPortalMe,
  fetchGetPortalOrderEvents,
  fetchGetPortalOrders,
  fetchGetPortalProducts,
  fetchGetPortalRechargeRecords,
  fetchPortalLogin,
  fetchPortalLogout
} from '@/service/api';
import { clearPortalAuthStorage, getPortalToken, setPortalToken } from '@/service/request/portal';
import { formatDateTime, formatFen, getStatusTagType } from '@/utils/format';

defineOptions({
  name: 'PortalPage'
});

type BatchOrderDraft = {
  id: string;
  channelOrderNo: string;
  mobile: string;
  faceValue: number | null;
  productType: Api.Portal.ProductType | '';
  extText: string;
};

const carrierOptions = [
  { label: '中国移动', value: 'CMCC' },
  { label: '中国电信', value: 'CTCC' },
  { label: '中国联通', value: 'CUCC' },
  { label: '中国广电', value: 'CBN' }
] satisfies CommonType.Option<Api.Portal.CarrierCode>[];

const productTypeOptions = [
  { label: 'FAST', value: 'FAST' },
  { label: 'MIXED', value: 'MIXED' }
] satisfies CommonType.Option<Api.Portal.ProductType>[];

const portalToken = ref(getPortalToken());
const initLoading = ref(false);
const loginLoading = ref(false);
const overviewLoading = ref(false);
const singleSubmitLoading = ref(false);
const batchSubmitLoading = ref(false);
const productsLoading = ref(false);
const ordersLoading = ref(false);
const eventsLoading = ref(false);
const rechargeLoading = ref(false);

const activeTab = ref<'overview' | 'single' | 'batch' | 'products' | 'orders' | 'events' | 'recharges'>('overview');

const loginModel = reactive({
  username: '',
  password: ''
});

const singleOrderForm = reactive({
  channelOrderNo: createOrderNo(),
  mobile: '',
  faceValue: null as number | null,
  productType: 'FAST' as Api.Portal.ProductType | '',
  extText: ''
});

const batchOrders = ref<BatchOrderDraft[]>([createBatchOrderDraft()]);

const portalMe = ref<Api.Portal.Me | null>(null);
const channelProfile = ref<Api.Portal.ChannelProfile | null>(null);
const channelQuota = ref<Api.Portal.ChannelQuota | null>(null);
const channelBalance = ref<Api.Channel.Balance | null>(null);
const balanceUnsupported = ref(false);
const productsLoaded = ref(false);
const products = ref<Api.Portal.ProductItem[]>([]);
const orders = ref<Api.Portal.OrderItem[]>([]);
const selectedOrder = ref<Api.Portal.OrderItem | null>(null);
const orderEvents = ref<Api.Portal.OrderEvent[]>([]);
const rechargeLoaded = ref(false);
const rechargeUnsupported = ref(false);
const rechargeRecords = ref<Api.Channel.RechargeRecord[]>([]);

const jsonModalVisible = ref(false);
const jsonModalTitle = ref('');
const jsonModalData = ref<unknown>(null);

const productFilter = reactive({
  carrierCode: null as Api.Portal.CarrierCode | null,
  province: '',
  faceValue: null as number | null,
  productType: '' as Api.Portal.ProductType | '',
  status: ''
});

const orderFilter = reactive({
  orderNo: '',
  channelOrderNo: '',
  mobile: '',
  mainStatus: '',
  supplierStatus: '',
  refundStatus: ''
});

const eventFilter = reactive({
  sortOrder: 'desc' as Api.Portal.SortOrder
});

const orderDateRange = ref<[number, number] | null>(null);
const eventDateRange = ref<[number, number] | null>(null);

const orderPagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onUpdatePage(page) {
    orderPagination.page = page;
    void loadOrders();
  },
  onUpdatePageSize(pageSize) {
    orderPagination.pageSize = pageSize;
    orderPagination.page = 1;
    void loadOrders();
  }
});

const eventPagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onUpdatePage(page) {
    eventPagination.page = page;
    void loadOrderEvents();
  },
  onUpdatePageSize(pageSize) {
    eventPagination.pageSize = pageSize;
    eventPagination.page = 1;
    void loadOrderEvents();
  }
});

const isAuthenticated = computed(() => Boolean(portalToken.value));
const quotaRule = computed(() => channelQuota.value?.limitRule || null);
const currentChannelCode = computed(() => portalMe.value?.channelCode || channelProfile.value?.channelCode || '--');
const currentChannelName = computed(() => portalMe.value?.channelName || channelProfile.value?.channelName || '渠道门户');

const productColumns = computed<NaiveUI.TableColumn<Api.Portal.ProductItem>[]>(() => [
  {
    key: 'productName',
    title: '商品名称',
    minWidth: 180
  },
  {
    key: 'operator',
    title: '运营商',
    width: 110
  },
  {
    key: 'carrierCode',
    title: '运营商编码',
    width: 120
  },
  {
    key: 'faceValueFen',
    title: '面值',
    width: 120,
    render: row => formatFen(row.faceValueFen)
  },
  {
    key: 'salePriceFen',
    title: '销售价',
    width: 120,
    render: row => formatFen(row.salePriceFen)
  },
  {
    key: 'routeStatus',
    title: '路由状态',
    width: 120,
    render: row => h(NTag, { type: getStatusTagType(row.routeStatus), bordered: false }, { default: () => row.routeStatus })
  },
  {
    key: 'splitSupport',
    title: '支持拆单',
    width: 100,
    render: row => renderBoolean(row.splitSupport)
  },
  {
    key: 'arrivalSla',
    title: '到账 SLA',
    width: 140
  },
  {
    key: 'rechargeRange',
    title: '支持面值',
    minWidth: 180,
    render: row => formatRechargeRange(row.rechargeRange)
  }
]);

const orderColumns = computed<NaiveUI.TableColumn<Api.Portal.OrderItem>[]>(() => [
  {
    key: 'orderNo',
    title: '平台订单号',
    minWidth: 180
  },
  {
    key: 'channelOrderNo',
    title: '渠道订单号',
    minWidth: 160
  },
  {
    key: 'mobile',
    title: '手机号',
    width: 130
  },
  {
    key: 'requestedProductType',
    title: '产品类型',
    width: 110
  },
  {
    key: 'faceValueAmountFen',
    title: '充值面值',
    width: 120,
    render: row => formatFen(row.faceValueAmountFen, row.currency)
  },
  {
    key: 'saleAmountFen',
    title: '销售金额',
    width: 120,
    render: row => formatFen(row.saleAmountFen, row.currency)
  },
  {
    key: 'mainStatus',
    title: '主状态',
    width: 110,
    render: row => h(NTag, { type: getStatusTagType(row.mainStatus), bordered: false }, { default: () => row.mainStatus })
  },
  {
    key: 'supplierStatus',
    title: '供应商状态',
    width: 130,
    render: row =>
      h(NTag, { type: getStatusTagType(row.supplierStatus), bordered: false }, { default: () => row.supplierStatus })
  },
  {
    key: 'refundStatus',
    title: '退款状态',
    width: 110,
    render: row => h(NTag, { type: getStatusTagType(row.refundStatus), bordered: false }, { default: () => row.refundStatus })
  },
  {
    key: 'createdAt',
    title: '创建时间',
    width: 170,
    render: row => formatDateTime(row.createdAt)
  },
  {
    key: 'actions',
    title: '操作',
    width: 140,
    fixed: 'right',
    render: row =>
      h('div', { class: 'flex items-center gap-8px' }, [
        h(
          NButton,
          {
            text: true,
            type: 'primary',
            onClick: () => selectOrder(row)
          },
          { default: () => '选中' }
        ),
        h(
          NButton,
          {
            text: true,
            type: 'primary',
            onClick: () => {
              selectOrder(row);
              activeTab.value = 'events';
            }
          },
          { default: () => '日志' }
        )
      ])
  }
]);

const eventColumns = computed<NaiveUI.TableColumn<Api.Portal.OrderEvent>[]>(() => [
  {
    key: 'occurredAt',
    title: '发生时间',
    width: 170,
    render: row => formatDateTime(row.occurredAt)
  },
  {
    key: 'eventType',
    title: '事件类型',
    minWidth: 180
  },
  {
    key: 'sourceService',
    title: '来源服务',
    width: 140
  },
  {
    key: 'sourceNo',
    title: '来源编号',
    minWidth: 180,
    render: row => renderNullable(row.sourceNo)
  },
  {
    key: 'operator',
    title: '操作人',
    width: 120
  },
  {
    key: 'beforeStatus',
    title: '前状态',
    width: 100,
    render: row =>
      h(
        NButton,
        {
          text: true,
          type: 'primary',
          onClick: () => openJson('变更前状态', row.beforeStatus)
        },
        { default: () => '查看' }
      )
  },
  {
    key: 'afterStatus',
    title: '后状态',
    width: 100,
    render: row =>
      h(
        NButton,
        {
          text: true,
          type: 'primary',
          onClick: () => openJson('变更后状态', row.afterStatus)
        },
        { default: () => '查看' }
      )
  },
  {
    key: 'payload',
    title: '日志载荷',
    width: 110,
    render: row =>
      h(
        NButton,
        {
          text: true,
          type: 'primary',
          onClick: () => openJson('日志载荷', row.payload)
        },
        { default: () => '查看' }
      )
  }
]);

const rechargeColumns = computed<NaiveUI.TableColumn<Api.Channel.RechargeRecord>[]>(() => [
  {
    key: 'createdAt',
    title: '充值时间',
    width: 170,
    render: row => formatDateTime(row.createdAt)
  },
  {
    key: 'amountFen',
    title: '充值金额',
    width: 120,
    render: row => formatFen(row.amountFen, row.currency)
  },
  {
    key: 'beforeBalanceFen',
    title: '充值前余额',
    width: 130,
    render: row => formatFen(row.beforeBalanceFen, row.currency)
  },
  {
    key: 'afterBalanceFen',
    title: '充值后余额',
    width: 130,
    render: row => formatFen(row.afterBalanceFen, row.currency)
  },
  {
    key: 'recordSource',
    title: '来源',
    width: 120
  },
  {
    key: 'operatorUsername',
    title: '操作人',
    width: 120,
    render: row => renderNullable(row.operatorUsername)
  },
  {
    key: 'remark',
    title: '备注',
    minWidth: 220,
    render: row => renderNullable(row.remark)
  }
]);

onMounted(async () => {
  if (portalToken.value) {
    await initializePortal();
  }
});

watch(activeTab, async tab => {
  if (!isAuthenticated.value) {
    return;
  }

  if (tab === 'products' && !productsLoaded.value) {
    await loadProducts();
  }

  if (tab === 'events' && selectedOrder.value) {
    eventPagination.page = 1;
    await loadOrderEvents();
  }

  if (tab === 'recharges' && !rechargeLoaded.value) {
    await loadRechargeRecords();
  }
});

watch(
  () => selectedOrder.value?.orderNo,
  async orderNo => {
    if (activeTab.value === 'events' && orderNo) {
      eventPagination.page = 1;
      await loadOrderEvents();
    }
  }
);

function createOrderNo() {
  return `CH${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

function createBatchOrderDraft(): BatchOrderDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    channelOrderNo: createOrderNo(),
    mobile: '',
    faceValue: null,
    productType: 'FAST',
    extText: ''
  };
}

function resetPortalState() {
  portalMe.value = null;
  channelProfile.value = null;
  channelQuota.value = null;
  channelBalance.value = null;
  balanceUnsupported.value = false;
  products.value = [];
  productsLoaded.value = false;
  orders.value = [];
  selectedOrder.value = null;
  orderEvents.value = [];
  rechargeRecords.value = [];
  rechargeLoaded.value = false;
  rechargeUnsupported.value = false;
  activeTab.value = 'overview';
  orderPagination.page = 1;
  orderPagination.pageSize = 10;
  orderPagination.itemCount = 0;
  eventPagination.page = 1;
  eventPagination.pageSize = 10;
  eventPagination.itemCount = 0;
  orderDateRange.value = null;
  eventDateRange.value = null;
}

function resetSingleForm() {
  Object.assign(singleOrderForm, {
    channelOrderNo: createOrderNo(),
    mobile: '',
    faceValue: null,
    productType: 'FAST',
    extText: ''
  });
}

function resetBatchOrders() {
  batchOrders.value = [createBatchOrderDraft()];
}

function selectOrder(row: Api.Portal.OrderItem) {
  selectedOrder.value = row;
}

function renderNullable(value?: string | null) {
  return value || '--';
}

function renderBoolean(value?: boolean) {
  return value ? '是' : '否';
}

function maskSecret(value?: string | null) {
  if (!value) {
    return '--';
  }

  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }

  return `${value.slice(0, 2)}${'*'.repeat(Math.max(value.length - 4, 2))}${value.slice(-2)}`;
}

function formatRechargeRange(values?: number[]) {
  if (!values?.length) {
    return '--';
  }

  return values.map(item => `${item}`).join(' / ');
}

function openJson(title: string, payload: unknown) {
  jsonModalTitle.value = title;
  jsonModalData.value = payload;
  jsonModalVisible.value = true;
}

function cleanQuery<T extends Record<string, unknown>>(query: T) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  ) as Partial<T>;
}

function buildRange(range: [number, number] | null) {
  if (!range) {
    return {};
  }

  return {
    startTime: dayjs(range[0]).toISOString(),
    endTime: dayjs(range[1]).toISOString()
  };
}

function normalizePagedData<T>(data: Api.Portal.PagedOrList<T> | Api.Common.PagedData<T> | T[] | null | undefined, page: number, pageSize: number) {
  if (Array.isArray(data)) {
    return {
      records: data,
      pageNum: page,
      pageSize,
      total: data.length,
      totalPages: 1
    };
  }

  return (
    data || {
      records: [] as T[],
      pageNum: page,
      pageSize,
      total: 0,
      totalPages: 0
    }
  );
}

function parseExtText(text: string, label: string) {
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    window.$message?.error(`${label}必须是合法的 JSON`);
    return null;
  }
}

async function initializePortal() {
  initLoading.value = true;

  const { data, error } = await fetchGetPortalMe();

  if (error) {
    clearPortalAuthStorage();
    portalToken.value = '';
    resetPortalState();
    initLoading.value = false;
    return;
  }

  portalMe.value = data;

  await Promise.all([loadOverview(), loadOrders()]);

  initLoading.value = false;
}

async function handleLogin() {
  const username = loginModel.username.trim();
  const password = loginModel.password.trim();

  if (!username || !password) {
    window.$message?.warning('请输入渠道账号和密码');
    return;
  }

  loginLoading.value = true;

  const { data, error } = await fetchPortalLogin(username, password);

  loginLoading.value = false;

  if (error) {
    return;
  }

  setPortalToken(data.accessToken);
  portalToken.value = data.accessToken;
  portalMe.value = data.me;
  loginModel.password = '';

  window.$message?.success('渠道门户登录成功');

  await Promise.all([loadOverview(), loadOrders()]);
}

async function handleLogout() {
  try {
    if (portalToken.value) {
      await fetchPortalLogout();
    }
  } finally {
    clearPortalAuthStorage();
    portalToken.value = '';
    resetPortalState();
    window.$message?.success('已退出渠道门户');
  }
}

async function loadOverview() {
  overviewLoading.value = true;

  const balancePromise = portalMe.value?.channelId
    ? fetchGetPortalChannelBalance(portalMe.value.channelId)
    : Promise.resolve(null);

  const [profileRes, quotaRes, balanceRes] = await Promise.all([
    fetchGetPortalChannelProfile(),
    fetchGetPortalChannelQuota(),
    balancePromise
  ]);

  channelProfile.value = profileRes.error ? null : profileRes.data;
  channelQuota.value = quotaRes.error ? null : quotaRes.data;

  if (balanceRes) {
    if (balanceRes.error) {
      channelBalance.value = null;
      balanceUnsupported.value = true;
    } else {
      channelBalance.value = balanceRes.data;
      balanceUnsupported.value = false;
    }
  }

  overviewLoading.value = false;
}

async function loadProducts() {
  productsLoading.value = true;

  const { data, error } = await fetchGetPortalProducts(
    cleanQuery({
      ...productFilter,
      carrierCode: productFilter.carrierCode || undefined,
      productType: productFilter.productType || undefined
    })
  );

  products.value = error ? [] : data;
  productsLoaded.value = true;
  productsLoading.value = false;
}

async function loadOrders() {
  ordersLoading.value = true;

  const page = Number(orderPagination.page || 1);
  const pageSize = Number(orderPagination.pageSize || 10);

  const params = cleanQuery({
    pageNum: page,
    pageSize,
    ...orderFilter,
    ...buildRange(orderDateRange.value)
  }) as Api.Portal.OrderQueryParams;

  const { data, error } = await fetchGetPortalOrders(params);

  if (error) {
    orders.value = [];
    orderPagination.itemCount = 0;
    ordersLoading.value = false;
    return;
  }

  const normalized = normalizePagedData(data, page, pageSize);

  orders.value = normalized.records;
  orderPagination.itemCount = normalized.total;

  if (selectedOrder.value) {
    const matchedOrder = normalized.records.find(item => item.orderNo === selectedOrder.value?.orderNo);

    if (matchedOrder) {
      selectedOrder.value = matchedOrder;
    }
  }

  if (!selectedOrder.value && normalized.records.length) {
    selectedOrder.value = normalized.records[0];
  }

  ordersLoading.value = false;
}

async function loadOrderEvents() {
  if (!selectedOrder.value?.orderNo) {
    orderEvents.value = [];
    eventPagination.itemCount = 0;
    return;
  }

  eventsLoading.value = true;

  const page = Number(eventPagination.page || 1);
  const pageSize = Number(eventPagination.pageSize || 10);

  const params = cleanQuery({
    pageNum: page,
    pageSize,
    sortOrder: eventFilter.sortOrder,
    ...buildRange(eventDateRange.value)
  }) as Api.Portal.OrderEventQueryParams;

  const { data, error } = await fetchGetPortalOrderEvents(selectedOrder.value.orderNo, params);

  if (error) {
    orderEvents.value = [];
    eventPagination.itemCount = 0;
    eventsLoading.value = false;
    return;
  }

  const normalized = normalizePagedData(data, page, pageSize);

  orderEvents.value = normalized.records;
  eventPagination.itemCount = normalized.total;
  eventsLoading.value = false;
}

async function loadRechargeRecords() {
  if (!portalMe.value?.channelId) {
    rechargeRecords.value = [];
    rechargeLoaded.value = true;
    return;
  }

  rechargeLoading.value = true;

  const { data, error } = await fetchGetPortalRechargeRecords(portalMe.value.channelId);

  if (error) {
    rechargeRecords.value = [];
    rechargeUnsupported.value = true;
  } else {
    rechargeRecords.value = data;
    rechargeUnsupported.value = false;
  }

  rechargeLoaded.value = true;
  rechargeLoading.value = false;
}

async function handleSubmitSingleOrder() {
  const channelOrderNo = singleOrderForm.channelOrderNo.trim();
  const mobile = singleOrderForm.mobile.trim();
  const faceValue = Number(singleOrderForm.faceValue);

  if (!channelOrderNo || !mobile || !faceValue) {
    window.$message?.warning('请完整填写单笔充值信息');
    return;
  }

  if (!/^\d{11}$/.test(mobile)) {
    window.$message?.warning('手机号必须为 11 位数字');
    return;
  }

  const ext = parseExtText(singleOrderForm.extText, '单笔扩展参数');

  if (ext === null) {
    return;
  }

  singleSubmitLoading.value = true;

  const payload: Api.Portal.CreateOrderForm = {
    channelOrderNo,
    mobile,
    faceValue,
    product_type: singleOrderForm.productType || undefined,
    ext: Object.keys(ext).length ? ext : undefined
  };

  const { data, error } = await fetchCreatePortalOrder(payload);

  singleSubmitLoading.value = false;

  if (error) {
    return;
  }

  window.$message?.success('单笔充值已提交');
  openJson('单笔充值结果', data);
  resetSingleForm();
  await loadOrders();
  activeTab.value = 'orders';
}

async function handleSubmitBatchOrders() {
  const ordersPayload: Api.Portal.BatchOrderItem[] = [];

  for (const [index, item] of batchOrders.value.entries()) {
    const channelOrderNo = item.channelOrderNo.trim();
    const mobile = item.mobile.trim();
    const faceValue = Number(item.faceValue);

    if (!channelOrderNo || !mobile || !faceValue) {
      window.$message?.warning(`请完整填写第 ${index + 1} 行批量充值信息`);
      return;
    }

    if (!/^\d{11}$/.test(mobile)) {
      window.$message?.warning(`第 ${index + 1} 行手机号必须为 11 位数字`);
      return;
    }

    const ext = parseExtText(item.extText, `第 ${index + 1} 行扩展参数`);

    if (ext === null) {
      return;
    }

    ordersPayload.push({
      channelOrderNo,
      mobile,
      faceValue,
      productType: item.productType || undefined,
      ext: Object.keys(ext).length ? ext : undefined
    });
  }

  if (!ordersPayload.length) {
    window.$message?.warning('请至少填写一条批量充值记录');
    return;
  }

  batchSubmitLoading.value = true;

  const { data, error } = await fetchCreatePortalBatchOrders({
    orders: ordersPayload
  });

  batchSubmitLoading.value = false;

  if (error) {
    return;
  }

  window.$message?.success('批量充值任务已提交');
  openJson('批量充值结果', data);
  resetBatchOrders();
  await loadOrders();
  activeTab.value = 'orders';
}

function addBatchOrder() {
  batchOrders.value.push(createBatchOrderDraft());
}

function removeBatchOrder(id: string) {
  if (batchOrders.value.length === 1) {
    window.$message?.warning('至少保留一条批量记录');
    return;
  }

  batchOrders.value = batchOrders.value.filter(item => item.id !== id);
}

function handleResetProductFilter() {
  Object.assign(productFilter, {
    carrierCode: null,
    province: '',
    faceValue: null,
    productType: '',
    status: ''
  });

  void loadProducts();
}

function handleResetOrderFilter() {
  Object.assign(orderFilter, {
    orderNo: '',
    channelOrderNo: '',
    mobile: '',
    mainStatus: '',
    supplierStatus: '',
    refundStatus: ''
  });
  orderDateRange.value = null;
  orderPagination.page = 1;
  void loadOrders();
}

function handleResetEventFilter() {
  eventFilter.sortOrder = 'desc';
  eventDateRange.value = null;
  eventPagination.page = 1;
  void loadOrderEvents();
}
</script>

<template>
  <div class="min-h-screen bg-[#f4f7fb] px-16px py-24px sm:px-24px lg:px-32px">
    <template v-if="!isAuthenticated">
      <div class="mx-auto max-w-1200px">
        <div class="grid gap-24px lg:grid-cols-[1.3fr_420px]">
          <div class="rounded-28px bg-gradient-to-br from-[#1037a6] via-[#1650d0] to-[#4d9cff] p-28px text-white shadow-lg">
            <div class="max-w-620px">
              <p class="text-14px uppercase tracking-[0.35em] text-white/70">Channel Portal</p>
              <h1 class="mt-16px text-40px font-700 leading-tight">渠道专属充值工作台</h1>
              <p class="mt-16px text-16px leading-7 text-white/82">
                使用管理平台为渠道配置的账号和密码登录，完成单笔充值、批量充值，并查询自己的消费记录、消费日志和充值日志。
              </p>
              <div class="mt-28px grid gap-12px sm:grid-cols-3">
                <div class="rounded-20px bg-white/12 p-16px backdrop-blur">
                  <div class="text-13px text-white/72">单笔充值</div>
                  <div class="mt-8px text-18px font-600">即时下单</div>
                </div>
                <div class="rounded-20px bg-white/12 p-16px backdrop-blur">
                  <div class="text-13px text-white/72">批量充值</div>
                  <div class="mt-8px text-18px font-600">多订单提交</div>
                </div>
                <div class="rounded-20px bg-white/12 p-16px backdrop-blur">
                  <div class="text-13px text-white/72">日志查询</div>
                  <div class="mt-8px text-18px font-600">消费与充值</div>
                </div>
              </div>
            </div>
          </div>

          <NCard :bordered="false" class="rounded-24px shadow-sm">
            <div class="mb-24px">
              <div class="text-26px font-700 text-[#1f2937]">渠道登录</div>
              <div class="mt-8px text-14px text-[#64748b]">登录后可查看自己的商品、订单和日志数据。</div>
            </div>

            <NForm label-placement="top" @keyup.enter="handleLogin">
              <NFormItem label="渠道账号">
                <NInput v-model:value="loginModel.username" placeholder="请输入渠道账号" size="large" />
              </NFormItem>
              <NFormItem label="渠道密码">
                <NInput
                  v-model:value="loginModel.password"
                  type="password"
                  show-password-on="click"
                  placeholder="请输入渠道密码"
                  size="large"
                />
              </NFormItem>
              <NButton type="primary" size="large" block :loading="loginLoading" @click="handleLogin">登录渠道门户</NButton>
            </NForm>
          </NCard>
        </div>
      </div>
    </template>

    <template v-else>
      <NSpin :show="initLoading">
        <div class="mx-auto max-w-1600px">
          <NCard :bordered="false" class="rounded-24px shadow-sm">
            <div class="flex flex-col gap-18px lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-12px">
                  <h1 class="text-30px font-700 text-[#111827]">{{ currentChannelName }}</h1>
                  <NTag type="primary" :bordered="false">{{ currentChannelCode }}</NTag>
                  <NTag v-if="portalMe" :type="getStatusTagType(portalMe.status)" :bordered="false">
                    {{ portalMe.status }}
                  </NTag>
                </div>
                <p class="mt-12px text-14px text-[#64748b]">
                  当前门户仅展示本渠道可见的数据与操作，支持单笔充值、批量充值、消费记录和日志追踪。
                </p>
                <div v-if="portalMe?.roleCodes?.length" class="mt-16px flex flex-wrap gap-8px">
                  <NTag v-for="role in portalMe.roleCodes" :key="role" size="small">{{ role }}</NTag>
                </div>
              </div>

              <div class="flex flex-wrap gap-12px">
                <NButton @click="loadOverview">
                  <template #icon>
                    <icon-mdi-refresh class="text-icon" :class="{ 'animate-spin': overviewLoading }" />
                  </template>
                  刷新概览
                </NButton>
                <NButton type="error" @click="handleLogout">退出登录</NButton>
              </div>
            </div>
          </NCard>

          <NTabs v-model:value="activeTab" class="mt-20px" animated>
            <NTabPane name="overview" tab="概览">
              <NSpin :show="overviewLoading">
                <NSpace vertical :size="16">
                  <NAlert v-if="balanceUnsupported" type="warning" :show-icon="false">
                    当前接口文档未提供门户侧余额接口，页面已优先展示渠道额度信息；若后端已开放同权限余额接口，这里会自动显示余额。
                  </NAlert>

                  <NGrid cols="1 s:2 xl:4" :x-gap="16" :y-gap="16">
                    <NGi>
                      <NCard size="small" title="可用余额">
                        <NStatistic :value="channelBalance ? channelBalance.availableBalanceFen / 100 : 0" suffix="元" />
                      </NCard>
                    </NGi>
                    <NGi>
                      <NCard size="small" title="冻结余额">
                        <NStatistic :value="channelBalance ? channelBalance.frozenBalanceFen / 100 : 0" suffix="元" />
                      </NCard>
                    </NGi>
                    <NGi>
                      <NCard size="small" title="单笔额度">
                        <NStatistic :value="quotaRule ? quotaRule.singleLimitAmountFen / 100 : 0" suffix="元" />
                      </NCard>
                    </NGi>
                    <NGi>
                      <NCard size="small" title="QPS">
                        <NStatistic :value="quotaRule?.qpsLimit || 0" />
                      </NCard>
                    </NGi>
                  </NGrid>

                  <NGrid cols="1 xl:2" :x-gap="16" :y-gap="16">
                    <NGi>
                      <NCard :bordered="false" title="渠道档案" class="card-wrapper">
                        <NDescriptions bordered :column="2" label-placement="left">
                          <NDescriptionsItem label="渠道编码">{{ renderNullable(channelProfile?.channelCode) }}</NDescriptionsItem>
                          <NDescriptionsItem label="渠道名称">{{ renderNullable(channelProfile?.channelName) }}</NDescriptionsItem>
                          <NDescriptionsItem label="渠道类型">{{ renderNullable(channelProfile?.channelType) }}</NDescriptionsItem>
                          <NDescriptionsItem label="协议类型">{{ renderNullable(channelProfile?.protocolType) }}</NDescriptionsItem>
                          <NDescriptionsItem label="合作状态">
                            <NTag
                              v-if="channelProfile"
                              :type="getStatusTagType(channelProfile.cooperationStatus)"
                              :bordered="false"
                            >
                              {{ channelProfile.cooperationStatus }}
                            </NTag>
                            <template v-else>--</template>
                          </NDescriptionsItem>
                          <NDescriptionsItem label="渠道状态">
                            <NTag v-if="channelProfile" :type="getStatusTagType(channelProfile.status)" :bordered="false">
                              {{ channelProfile.status }}
                            </NTag>
                            <template v-else>--</template>
                          </NDescriptionsItem>
                          <NDescriptionsItem label="接入账号">{{ renderNullable(channelProfile?.accessAccount) }}</NDescriptionsItem>
                          <NDescriptionsItem label="接入密码">{{ maskSecret(channelProfile?.accessPassword) }}</NDescriptionsItem>
                          <NDescriptionsItem label="联系人">{{ renderNullable(channelProfile?.contactName) }}</NDescriptionsItem>
                          <NDescriptionsItem label="联系电话">{{ renderNullable(channelProfile?.contactPhone) }}</NDescriptionsItem>
                          <NDescriptionsItem label="联系邮箱">{{ renderNullable(channelProfile?.contactEmail) }}</NDescriptionsItem>
                          <NDescriptionsItem label="支持消费日志">
                            {{ renderBoolean(channelProfile?.supportsConsumptionLog) }}
                          </NDescriptionsItem>
                          <NDescriptionsItem label="结算模式">{{ renderNullable(channelProfile?.settlementMode) }}</NDescriptionsItem>
                          <NDescriptionsItem label="创建时间">{{ formatDateTime(channelProfile?.createdAt) }}</NDescriptionsItem>
                          <NDescriptionsItem label="更新时间">{{ formatDateTime(channelProfile?.updatedAt) }}</NDescriptionsItem>
                          <NDescriptionsItem label="接口地址" :span="2">{{ renderNullable(channelProfile?.baseUrl) }}</NDescriptionsItem>
                          <NDescriptionsItem label="备注" :span="2">{{ renderNullable(channelProfile?.remark) }}</NDescriptionsItem>
                        </NDescriptions>
                      </NCard>
                    </NGi>

                    <NGi>
                      <NCard :bordered="false" title="渠道额度" class="card-wrapper">
                        <NDescriptions bordered :column="2" label-placement="left">
                          <NDescriptionsItem label="单笔额度">
                            {{ quotaRule ? formatFen(quotaRule.singleLimitAmountFen) : '--' }}
                          </NDescriptionsItem>
                          <NDescriptionsItem label="日额度">
                            {{ quotaRule ? formatFen(quotaRule.dailyLimitAmountFen) : '--' }}
                          </NDescriptionsItem>
                          <NDescriptionsItem label="月额度">
                            {{ quotaRule ? formatFen(quotaRule.monthlyLimitAmountFen) : '--' }}
                          </NDescriptionsItem>
                          <NDescriptionsItem label="QPS">{{ quotaRule?.qpsLimit ?? '--' }}</NDescriptionsItem>
                          <NDescriptionsItem label="余额更新时间">
                            {{ formatDateTime(channelBalance?.updatedAt) }}
                          </NDescriptionsItem>
                          <NDescriptionsItem label="余额状态">
                            <NTag v-if="channelBalance" :type="getStatusTagType(channelBalance.status)" :bordered="false">
                              {{ channelBalance.status }}
                            </NTag>
                            <template v-else>--</template>
                          </NDescriptionsItem>
                        </NDescriptions>

                        <div v-if="portalMe?.permissions?.length" class="mt-16px">
                          <div class="mb-10px text-13px text-[#64748b]">门户权限</div>
                          <div class="flex flex-wrap gap-8px">
                            <NTag v-for="permission in portalMe.permissions" :key="permission" size="small">
                              {{ permission }}
                            </NTag>
                          </div>
                        </div>
                      </NCard>
                    </NGi>
                  </NGrid>
                </NSpace>
              </NSpin>
            </NTabPane>

            <NTabPane name="single" tab="单笔充值">
              <NCard :bordered="false" title="发起单笔充值" class="card-wrapper">
                <NForm label-placement="left" label-width="96">
                  <NGrid cols="1 s:2" :x-gap="16" :y-gap="8">
                    <NGi>
                      <NFormItem label="渠道订单号">
                        <NInput v-model:value="singleOrderForm.channelOrderNo" placeholder="请输入渠道订单号" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="手机号">
                        <NInput v-model:value="singleOrderForm.mobile" placeholder="请输入 11 位手机号" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="充值面值">
                        <NInputNumber
                          v-model:value="singleOrderForm.faceValue"
                          class="w-full"
                          :min="1"
                          placeholder="请输入面值"
                        />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="产品类型">
                        <NSelect v-model:value="singleOrderForm.productType" :options="productTypeOptions" clearable />
                      </NFormItem>
                    </NGi>
                    <NGi span="2">
                      <NFormItem label="扩展参数">
                        <NInput
                          v-model:value="singleOrderForm.extText"
                          type="textarea"
                          :rows="5"
                          placeholder="可选，输入 JSON，例如 {&quot;notify&quot;:&quot;manual&quot;}"
                        />
                      </NFormItem>
                    </NGi>
                  </NGrid>
                </NForm>

                <div class="flex justify-end gap-12px">
                  <NButton @click="resetSingleForm">重置</NButton>
                  <NButton type="primary" :loading="singleSubmitLoading" @click="handleSubmitSingleOrder">
                    提交单笔充值
                  </NButton>
                </div>
              </NCard>
            </NTabPane>

            <NTabPane name="batch" tab="批量充值">
              <NCard :bordered="false" title="发起批量充值" class="card-wrapper">
                <template #header-extra>
                  <NButton type="primary" ghost @click="addBatchOrder">
                    <template #icon>
                      <icon-ic-round-plus class="text-icon" />
                    </template>
                    新增一行
                  </NButton>
                </template>

                <NSpace vertical :size="16">
                  <NAlert type="info" :show-icon="false">
                    每行代表一笔充值订单。渠道订单号建议保持唯一，扩展参数支持选填 JSON。
                  </NAlert>

                  <NCard
                    v-for="(item, index) in batchOrders"
                    :key="item.id"
                    size="small"
                    :title="`第 ${index + 1} 笔`"
                    class="border border-solid border-[#e5e7eb]"
                  >
                    <template #header-extra>
                      <NButton text type="error" @click="removeBatchOrder(item.id)">删除</NButton>
                    </template>

                    <NGrid cols="1 s:2 xl:4" :x-gap="16" :y-gap="8">
                      <NGi>
                        <NFormItem label="渠道订单号">
                          <NInput v-model:value="item.channelOrderNo" placeholder="请输入渠道订单号" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="手机号">
                          <NInput v-model:value="item.mobile" placeholder="请输入 11 位手机号" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="充值面值">
                          <NInputNumber v-model:value="item.faceValue" class="w-full" :min="1" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="产品类型">
                          <NSelect v-model:value="item.productType" :options="productTypeOptions" clearable />
                        </NFormItem>
                      </NGi>
                      <NGi span="4">
                        <NFormItem label="扩展参数">
                          <NInput
                            v-model:value="item.extText"
                            type="textarea"
                            :rows="3"
                            placeholder="可选，输入 JSON，例如 {&quot;batch&quot;:&quot;yes&quot;}"
                          />
                        </NFormItem>
                      </NGi>
                    </NGrid>
                  </NCard>

                  <div class="flex justify-end gap-12px">
                    <NButton @click="resetBatchOrders">重置</NButton>
                    <NButton type="primary" :loading="batchSubmitLoading" @click="handleSubmitBatchOrders">
                      提交批量充值
                    </NButton>
                  </div>
                </NSpace>
              </NCard>
            </NTabPane>

            <NTabPane name="products" tab="商品列表">
              <NCard :bordered="false" title="可售商品" class="card-wrapper">
                <NSpace vertical :size="16">
                  <NForm label-placement="left" label-width="88">
                    <NGrid cols="1 s:2 xl:5" :x-gap="16" :y-gap="8">
                      <NGi>
                        <NFormItem label="运营商">
                          <NSelect
                            v-model:value="productFilter.carrierCode"
                            :options="carrierOptions"
                            clearable
                            placeholder="全部"
                          />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="省份">
                          <NInput v-model:value="productFilter.province" placeholder="如：广东" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="面值">
                          <NInputNumber v-model:value="productFilter.faceValue" class="w-full" :min="1" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="产品类型">
                          <NSelect v-model:value="productFilter.productType" :options="productTypeOptions" clearable />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="状态">
                          <NInput v-model:value="productFilter.status" placeholder="如：enabled" />
                        </NFormItem>
                      </NGi>
                    </NGrid>
                  </NForm>

                  <div class="flex justify-end gap-12px">
                    <NButton @click="handleResetProductFilter">重置</NButton>
                    <NButton type="primary" :loading="productsLoading" @click="loadProducts">查询商品</NButton>
                  </div>

                  <NDataTable :columns="productColumns" :data="products" :loading="productsLoading" :scroll-x="1180" />
                </NSpace>
              </NCard>
            </NTabPane>

            <NTabPane name="orders" tab="消费记录">
              <NCard :bordered="false" title="充值消费记录" class="card-wrapper">
                <NSpace vertical :size="16">
                  <NForm label-placement="left" label-width="88">
                    <NGrid cols="1 s:2 xl:4" :x-gap="16" :y-gap="8">
                      <NGi>
                        <NFormItem label="平台订单号">
                          <NInput v-model:value="orderFilter.orderNo" placeholder="请输入订单号" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="渠道订单号">
                          <NInput v-model:value="orderFilter.channelOrderNo" placeholder="请输入渠道订单号" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="手机号">
                          <NInput v-model:value="orderFilter.mobile" placeholder="请输入手机号" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="主状态">
                          <NInput v-model:value="orderFilter.mainStatus" placeholder="如：success" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="供应商状态">
                          <NInput v-model:value="orderFilter.supplierStatus" placeholder="如：processing" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="退款状态">
                          <NInput v-model:value="orderFilter.refundStatus" placeholder="如：none" />
                        </NFormItem>
                      </NGi>
                      <NGi span="2">
                        <NFormItem label="时间范围">
                          <NDatePicker v-model:value="orderDateRange" class="w-full" type="datetimerange" clearable />
                        </NFormItem>
                      </NGi>
                    </NGrid>
                  </NForm>

                  <div class="flex justify-end gap-12px">
                    <NButton @click="handleResetOrderFilter">重置</NButton>
                    <NButton type="primary" :loading="ordersLoading" @click="loadOrders">查询记录</NButton>
                  </div>

                  <NDataTable
                    :columns="orderColumns"
                    :data="orders"
                    :loading="ordersLoading"
                    :pagination="orderPagination"
                    :row-key="row => row.orderNo"
                    :scroll-x="1520"
                    :row-props="
                      row => ({
                        style:
                          row.orderNo === selectedOrder?.orderNo
                            ? 'cursor:pointer;background-color: rgba(22, 80, 208, 0.08);'
                            : 'cursor:pointer;',
                        onClick: () => selectOrder(row)
                      })
                    "
                  />

                  <NCard v-if="selectedOrder" size="small" title="当前选中订单">
                    <NDescriptions bordered :column="3" label-placement="left">
                      <NDescriptionsItem label="平台订单号">{{ selectedOrder.orderNo }}</NDescriptionsItem>
                      <NDescriptionsItem label="渠道订单号">{{ selectedOrder.channelOrderNo }}</NDescriptionsItem>
                      <NDescriptionsItem label="手机号">{{ selectedOrder.mobile }}</NDescriptionsItem>
                      <NDescriptionsItem label="省份">{{ renderNullable(selectedOrder.province) }}</NDescriptionsItem>
                      <NDescriptionsItem label="运营商">{{ renderNullable(selectedOrder.ispName) }}</NDescriptionsItem>
                      <NDescriptionsItem label="产品类型">{{ selectedOrder.requestedProductType }}</NDescriptionsItem>
                      <NDescriptionsItem label="充值面值">
                        {{ formatFen(selectedOrder.faceValueAmountFen, selectedOrder.currency) }}
                      </NDescriptionsItem>
                      <NDescriptionsItem label="销售金额">
                        {{ formatFen(selectedOrder.saleAmountFen, selectedOrder.currency) }}
                      </NDescriptionsItem>
                      <NDescriptionsItem label="采购金额">
                        {{ formatFen(selectedOrder.purchaseAmountFen, selectedOrder.currency) }}
                      </NDescriptionsItem>
                      <NDescriptionsItem label="主状态">{{ selectedOrder.mainStatus }}</NDescriptionsItem>
                      <NDescriptionsItem label="供应商状态">{{ selectedOrder.supplierStatus }}</NDescriptionsItem>
                      <NDescriptionsItem label="退款状态">{{ selectedOrder.refundStatus }}</NDescriptionsItem>
                      <NDescriptionsItem label="异常标记">{{ renderNullable(selectedOrder.exceptionTag) }}</NDescriptionsItem>
                      <NDescriptionsItem label="创建时间">{{ formatDateTime(selectedOrder.createdAt) }}</NDescriptionsItem>
                      <NDescriptionsItem label="完成时间">{{ formatDateTime(selectedOrder.finishedAt) }}</NDescriptionsItem>
                    </NDescriptions>
                  </NCard>
                </NSpace>
              </NCard>
            </NTabPane>

            <NTabPane name="events" tab="消费日志">
              <NCard :bordered="false" title="消费日志追踪" class="card-wrapper">
                <template v-if="selectedOrder">
                  <NSpace vertical :size="16">
                    <NAlert type="info" :show-icon="false">
                      当前查看订单：{{ selectedOrder.orderNo }} / {{ selectedOrder.channelOrderNo }}
                    </NAlert>

                    <NForm label-placement="left" label-width="88">
                      <NGrid cols="1 s:2 xl:3" :x-gap="16" :y-gap="8">
                        <NGi>
                          <NFormItem label="排序">
                            <NSelect
                              v-model:value="eventFilter.sortOrder"
                              :options="[
                                { label: '倒序', value: 'desc' },
                                { label: '正序', value: 'asc' }
                              ]"
                            />
                          </NFormItem>
                        </NGi>
                        <NGi span="2">
                          <NFormItem label="时间范围">
                            <NDatePicker v-model:value="eventDateRange" class="w-full" type="datetimerange" clearable />
                          </NFormItem>
                        </NGi>
                      </NGrid>
                    </NForm>

                    <div class="flex justify-end gap-12px">
                      <NButton @click="handleResetEventFilter">重置</NButton>
                      <NButton type="primary" :loading="eventsLoading" @click="loadOrderEvents">查询日志</NButton>
                    </div>

                    <NDataTable
                      :columns="eventColumns"
                      :data="orderEvents"
                      :loading="eventsLoading"
                      :pagination="eventPagination"
                      :scroll-x="1280"
                    />
                  </NSpace>
                </template>
                <NEmpty v-else description="请先在消费记录中选中一笔订单，再查看日志。" class="py-48px" />
              </NCard>
            </NTabPane>

            <NTabPane name="recharges" tab="充值日志">
              <NCard :bordered="false" title="渠道充值日志" class="card-wrapper">
                <NSpace vertical :size="16">
                  <NAlert v-if="rechargeUnsupported" type="warning" :show-icon="false">
                    当前接口文档未给出门户侧充值日志接口，页面已尝试按当前渠道身份读取充值日志；若后端未开放该权限，将显示为空。
                  </NAlert>

                  <div class="flex justify-end">
                    <NButton :loading="rechargeLoading" @click="loadRechargeRecords">刷新充值日志</NButton>
                  </div>

                  <NDataTable :columns="rechargeColumns" :data="rechargeRecords" :loading="rechargeLoading" :scroll-x="1060" />
                </NSpace>
              </NCard>
            </NTabPane>
          </NTabs>
        </div>
      </NSpin>
    </template>

    <JsonModal v-model:visible="jsonModalVisible" :title="jsonModalTitle" :data="jsonModalData" />
  </div>
</template>

<style scoped></style>
