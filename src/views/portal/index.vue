<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { NButton, NTag, type PaginationProps } from 'naive-ui';
import {
  fetchCreatePortalOrder,
  fetchGetAdminProducts,
  fetchGetPortalBatchTemplate,
  fetchGetPortalChannelBalance,
  fetchGetPortalChannelProfile,
  fetchGetPortalCustomerDetail,
  fetchGetPortalChannelQuota,
  fetchGetPortalMe,
  fetchGetPortalOrderEvents,
  fetchGetPortalOrders,
  fetchGetPortalProducts,
  fetchGetPortalRechargeRecords,
  fetchPortalLogout,
  fetchPreviewPortalOrderSplit
} from '@/service/api';
import { clearPortalAuthStorage, getPortalToken } from '@/service/request/portal';
import { localStg } from '@/utils/storage';
import { formatDateTime, formatFen, getStatusTagType, stringifyJson } from '@/utils/format';
import {
  createPortalOrderNo,
  downloadCsv,
  downloadTemplateWorkbook,
  formatAmountYuan,
  getCarrierLabel,
  inferProductType,
  inferProvinceFromProductName,
  parseBatchText,
  readBatchFile,
  renderNullable,
  type ParsedBatchRow
} from './shared';

defineOptions({
  name: 'PortalPage'
});

type TabKey = 'overview' | 'single' | 'batch' | 'products' | 'orders' | 'events' | 'recharges';

interface Props {
  section?: TabKey;
}

type ProductRow = {
  id: string;
  productCode: string;
  productName: string;
  carrierCode: string;
  operator: string;
  provinceName: string;
  faceValueFen: number;
  salePriceFen: number | null;
  productType: string;
  status: string;
  routeStatus: string;
  splitSupport: boolean | null;
  arrivalSla: string | null;
  salesUnit: string;
  sourceLabel: string;
};

type RechargeLogRow = {
  id: string;
  logType: 'SUBMIT' | 'EVENT';
  eventType: string;
  orderNo: string;
  channelOrderNo: string;
  mobile: string;
  faceValue: number;
  currency: string;
  productType: string;
  mainStatus: string;
  supplierStatus: string;
  sourceNo: string | null;
  beforeStatusJson: Record<string, unknown> | null;
  afterStatusJson: Record<string, unknown> | null;
  occurredAt: string;
};

type BatchSubmitResult = {
  lineNo: number;
  channelOrderNo: string;
  mobile: string;
  faceValue: number;
  productType: string;
  success: boolean;
  orderNo: string;
  mainStatus: string;
  supplierStatus: string;
  message: string;
  createdAt: string;
};

type TabOption = {
  name: TabKey;
  label: string;
  description: string;
  hint: string;
};

const props = withDefaults(defineProps<Props>(), {
  section: 'overview'
});

const route = useRoute();
const router = useRouter();
const portalToken = ref(getPortalToken());
const activeTab = ref<TabKey>(props.section);
const initLoading = ref(false);
const overviewLoading = ref(false);
const previewLoading = ref(false);
const singleSubmitting = ref(false);
const batchTemplateLoading = ref(false);
const batchSubmitting = ref(false);
const productsLoading = ref(false);
const ordersLoading = ref(false);
const eventsLoading = ref(false);
const rechargeLoading = ref(false);
const productLoaded = ref(false);
const rechargeLoaded = ref(false);

const adminTokenAvailable = ref(false);
const adminAccessNote = ref('');
const balanceHint = ref('');
const rechargeHint = ref('');

const portalMe = ref<Api.Portal.Me | null>(null);
const channelProfile = ref<Api.Portal.ChannelProfile | null>(null);
const channelQuota = ref<Api.Portal.ChannelQuota | null>(null);
const channelBalance = ref<Api.Channel.Balance | null>(null);

const singleForm = reactive({
  channelOrderNo: createPortalOrderNo('single'),
  mobile: '',
  faceValue: null as number | null,
  productType: '' as Api.Portal.ProductType | '',
  extText: ''
});
const singlePreview = ref<Api.Portal.OrderPreviewResult | null>(null);

const batchFileInputRef = ref<HTMLInputElement | null>(null);
const batchForm = reactive({
  content: ''
});
const batchRows = ref<ParsedBatchRow[]>([]);
const batchErrors = ref<string[]>([]);
const batchResults = ref<BatchSubmitResult[]>([]);

const productFilter = reactive({
  keyword: '',
  carrierCode: null as Api.Portal.CarrierCode | null,
  province: '',
  faceValue: null as number | null,
  productType: '' as Api.Portal.ProductType | '',
  status: ''
});
const productSourceLabel = ref('当前使用 /open-api/products');
const productRows = ref<ProductRow[]>([]);
const portalProductPool = ref<ProductRow[]>([]);
const syncedProductBaseRows = ref<ProductRow[]>([]);

const orderFilter = reactive({
  orderNo: '',
  channelOrderNo: '',
  mobile: '',
  mainStatus: '',
  supplierStatus: '',
  refundStatus: ''
});
const orderDateRange = ref<[number, number] | null>(null);
const orders = ref<Api.Portal.OrderItem[]>([]);
const selectedOrder = ref<Api.Portal.OrderItem | null>(null);

const eventFilter = reactive({
  orderNo: '',
  sortOrder: 'desc' as Api.Portal.SortOrder
});
const eventDateRange = ref<[number, number] | null>(null);
const eventRows = ref<Api.Portal.OrderEvent[]>([]);
const eventDisplayRows = ref<Api.Portal.OrderEvent[]>([]);

const rechargeFilter = reactive({
  orderNo: '',
  channelOrderNo: '',
  mobile: '',
  mainStatus: '',
  supplierStatus: '',
  refundStatus: ''
});
const rechargeDateRange = ref<[number, number] | null>(null);
const rechargeRecords = ref<any[]>([]);

const jsonModalVisible = ref(false);
const jsonModalTitle = ref('');
const jsonModalData = ref<unknown>(null);

const tabOptions = [
  { name: 'overview', label: '概览', description: '查看账号信息、额度规则与余额概况。', hint: '总览' },
  { name: 'single', label: '单笔充值', description: '按手机号和金额智能匹配商品并立即下单。', hint: '实时' },
  { name: 'batch', label: '批量充值', description: '支持文本或文件导入，校验后逐条提交。', hint: '导入' },
  { name: 'products', label: '商品列表', description: '查看可售商品、运营商、面值与状态。', hint: '商品' },
  { name: 'orders', label: '消费记录', description: '查询订单状态、结果与处理进度。', hint: '订单' },
  { name: 'events', label: '消费日志', description: '追踪订单事件流转，快速定位异常。', hint: '日志' },
  { name: 'recharges', label: '充值日志', description: '查看渠道账户充值流水与余额变动。', hint: '账务' }
] satisfies TabOption[];

const portalSectionRouteMap: Record<TabKey, string> = {
  overview: 'portal_overview',
  single: 'portal_single',
  batch: 'portal_batch',
  products: 'portal_products',
  orders: 'portal_orders',
  events: 'portal_events',
  recharges: 'portal_recharges'
};

const productPagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onUpdatePage(page) {
    productPagination.page = page;
    syncPortalProductPage();
  },
  onUpdatePageSize(pageSize) {
    productPagination.pageSize = pageSize;
    productPagination.page = 1;
    syncPortalProductPage();
  }
});

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
    syncEventPage();
  },
  onUpdatePageSize(pageSize) {
    eventPagination.pageSize = pageSize;
    eventPagination.page = 1;
    syncEventPage();
  }
});

const currentChannelName = computed(
  () => portalMe.value?.channelName || channelProfile.value?.channelName || '渠道门户'
);
const currentChannelCode = computed(() => portalMe.value?.channelCode || channelProfile.value?.channelCode || '--');
const currentProtocolType = computed(() => channelProfile.value?.protocolType || '--');
const currentStatus = computed(() => portalMe.value?.status || channelProfile.value?.status || '--');
const _roleCount = computed(() => portalMe.value?.roleCodes?.length || 0);
const _permissionCount = computed(() => portalMe.value?.permissions?.length || 0);
const roleCodeText = computed(() => {
  const roles = portalMe.value?.roleCodes?.filter(Boolean) || [];

  return roles.length ? roles.join('、') : '--';
});
const permissionText = computed(() => {
  const permissions = portalMe.value?.permissions?.filter(Boolean) || [];

  return permissions.length ? permissions.join('、') : '--';
});
const activeTabMeta = computed(() => tabOptions.find(item => item.name === activeTab.value) ?? tabOptions[0]);
const overviewJson = computed(() => stringifyJson(channelProfile.value || portalMe.value || {}));
const previewSummaryText = computed(() => {
  if (!singlePreview.value) {
    return '输入手机号和充值金额后，可先预览运营商、省份和拆单结果。';
  }

  if (!singlePreview.value.matched) {
    return singlePreview.value.unmatchedReason || '当前条件下未匹配到可充值商品。';
  }

  return singlePreview.value.usedSplit
    ? '系统已按当前金额返回拆单组合，提交时将按该组合发起充值。'
    : '当前金额已命中单个商品，可直接提交充值。';
});

const _productColumns = computed<NaiveUI.TableColumn<ProductRow>[]>(() => [
  {
    key: 'productName',
    title: '商品名称',
    minWidth: 220
  },
  {
    key: 'productCode',
    title: '商品编码',
    minWidth: 180
  },
  {
    key: 'carrierCode',
    title: '运营商',
    width: 120,
    render: row => `${row.operator} (${row.carrierCode})`
  },
  {
    key: 'provinceName',
    title: '归属省份',
    width: 120
  },
  {
    key: 'faceValueFen',
    title: '面值',
    width: 110,
    render: row => formatFen(row.faceValueFen)
  },
  {
    key: 'salePriceFen',
    title: '售价',
    width: 110,
    render: row => formatFen(row.salePriceFen ?? row.faceValueFen)
  },
  {
    key: 'productType',
    title: '产品类型',
    width: 110,
    render: row => row.productType || '--'
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    render: row =>
      h(
        NTag,
        { type: getStatusTagType(row.status || row.routeStatus), bordered: false },
        { default: () => row.status || row.routeStatus }
      )
  },
  {
    key: 'arrivalSla',
    title: '到账时效',
    width: 110,
    render: row => row.arrivalSla || '--'
  },
  {
    key: 'splitSupport',
    title: '支持拆单',
    width: 100,
    render: row => renderBoolean(row.splitSupport)
  },
  {
    key: 'sourceLabel',
    title: '来源',
    width: 110
  }
]);

const previewColumns = computed<NaiveUI.TableColumn<Api.Portal.OrderPreviewPiece>[]>(() => [
  {
    key: 'productName',
    title: '命中商品',
    minWidth: 220
  },
  {
    key: 'supplierName',
    title: '供应商',
    minWidth: 140
  },
  {
    key: 'faceValueAmountFen',
    title: '面值',
    width: 120,
    render: row => formatFen(row.faceValueAmountFen)
  },
  {
    key: 'saleAmountFen',
    title: '销售价',
    width: 120,
    render: row => formatFen(row.saleAmountFen)
  },
  {
    key: 'purchaseAmountFen',
    title: '采购价',
    width: 120,
    render: row => formatFen(row.purchaseAmountFen)
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
    key: 'province',
    title: '归属地',
    width: 100,
    render: row => renderNullable(row.province)
  },
  {
    key: 'ispName',
    title: '运营商',
    width: 110,
    render: row => getCarrierLabel(row.ispName)
  },
  {
    key: 'faceValue',
    title: '充值金额',
    width: 110,
    render: row => formatAmountYuan(row.faceValue, row.currency)
  },
  {
    key: 'requestedProductType',
    title: '产品类型',
    width: 110
  },
  {
    key: 'mainStatus',
    title: '主状态',
    width: 110,
    render: row =>
      h(NTag, { type: getStatusTagType(row.mainStatus), bordered: false }, { default: () => row.mainStatus })
  },
  {
    key: 'supplierStatus',
    title: '供应商状态',
    width: 120,
    render: row =>
      h(NTag, { type: getStatusTagType(row.supplierStatus), bordered: false }, { default: () => row.supplierStatus })
  },
  {
    key: 'refundStatus',
    title: '退款状态',
    width: 110,
    render: row =>
      h(NTag, { type: getStatusTagType(row.refundStatus), bordered: false }, { default: () => row.refundStatus })
  },
  {
    key: 'createdAt',
    title: '创建时间',
    minWidth: 160,
    render: row => formatDateTime(row.createdAt)
  },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    fixed: 'right',
    render: row =>
      h(
        NButton,
        {
          type: 'primary',
          text: true,
          onClick: () => handleViewEvents(row)
        },
        { default: () => '查看日志' }
      )
  }
]);

const eventColumns = computed<NaiveUI.TableColumn<Api.Portal.OrderEvent>[]>(() => [
  {
    key: 'eventType',
    title: '事件类型',
    minWidth: 160
  },
  {
    key: 'sourceNo',
    title: '来源单号',
    minWidth: 180,
    render: row => renderNullable(row.sourceNo)
  },
  {
    key: 'beforeStatusJson',
    title: '前状态',
    width: 110,
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          tertiary: true,
          onClick: () => openJson('事件前状态', row.beforeStatusJson)
        },
        { default: () => '查看' }
      )
  },
  {
    key: 'afterStatusJson',
    title: '后状态',
    width: 110,
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          tertiary: true,
          onClick: () => openJson('事件后状态', row.afterStatusJson)
        },
        { default: () => '查看' }
      )
  },
  {
    key: 'occurredAt',
    title: '发生时间',
    minWidth: 160,
    render: row => formatDateTime(row.occurredAt)
  }
]);

const _rechargeColumns = computed<NaiveUI.TableColumn<Api.Channel.RechargeRecord>[]>(() => [
  {
    key: 'recordId',
    title: '流水号',
    minWidth: 180
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
    minWidth: 180,
    render: row => renderNullable(row.remark)
  },
  {
    key: 'createdAt',
    title: '创建时间',
    minWidth: 160,
    render: row => formatDateTime(row.createdAt)
  }
]);

const portalProductColumns = computed<NaiveUI.TableColumn<ProductRow>[]>(() => [
  {
    key: 'productName',
    title: '商品名称',
    minWidth: 220
  },
  {
    key: 'productCode',
    title: '商品编码',
    minWidth: 180
  },
  {
    key: 'carrierCode',
    title: '运营商',
    width: 120,
    render: row => `${row.operator} (${row.carrierCode})`
  },
  {
    key: 'provinceName',
    title: '省份',
    width: 120
  },
  {
    key: 'faceValueFen',
    title: '面值',
    width: 110,
    render: row => formatFen(row.faceValueFen)
  },
  {
    key: 'salePriceFen',
    title: '售价',
    width: 110,
    render: row => formatFen(row.salePriceFen ?? row.faceValueFen)
  },
  {
    key: 'productType',
    title: '产品类型',
    width: 110,
    render: row => row.productType || '--'
  },
  {
    key: 'salesUnit',
    title: '销售单位',
    width: 100,
    render: row => row.salesUnit || '--'
  },
  {
    key: 'status',
    title: '商品状态',
    width: 110,
    render: row =>
      h(NTag, { type: getStatusTagType(row.status), bordered: false }, { default: () => row.status || '--' })
  },
  {
    key: 'routeStatus',
    title: '路由状态',
    width: 120,
    render: row =>
      h(NTag, { type: getStatusTagType(row.routeStatus), bordered: false }, { default: () => row.routeStatus || '--' })
  },
  {
    key: 'splitSupport',
    title: '支持拆单',
    width: 100,
    render: row => renderBoolean(row.splitSupport)
  },
  {
    key: 'arrivalSla',
    title: '到账时效',
    width: 120,
    render: row => row.arrivalSla || '--'
  },
  {
    key: 'sourceLabel',
    title: '来源',
    minWidth: 150
  }
]);

const portalRechargeColumns = computed<NaiveUI.TableColumn<RechargeLogRow>[]>(() => [
  {
    key: 'occurredAt',
    title: '发生时间',
    minWidth: 160,
    render: row => formatDateTime(row.occurredAt)
  },
  {
    key: 'logType',
    title: '日志类型',
    width: 110,
    render: row =>
      h(
        NTag,
        { type: row.logType === 'SUBMIT' ? 'info' : 'default', bordered: false },
        {
          default: () => (row.logType === 'SUBMIT' ? '订单提交' : '状态事件')
        }
      )
  },
  {
    key: 'eventType',
    title: '事件类型',
    minWidth: 160
  },
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
    key: 'faceValue',
    title: '充值金额',
    width: 120,
    render: row => formatAmountYuan(row.faceValue, row.currency)
  },
  {
    key: 'productType',
    title: '产品类型',
    width: 110,
    render: row => row.productType || '--'
  },
  {
    key: 'mainStatus',
    title: '主状态',
    width: 110,
    render: row =>
      h(NTag, { type: getStatusTagType(row.mainStatus), bordered: false }, { default: () => row.mainStatus })
  },
  {
    key: 'supplierStatus',
    title: '供应商状态',
    width: 120,
    render: row =>
      h(NTag, { type: getStatusTagType(row.supplierStatus), bordered: false }, { default: () => row.supplierStatus })
  },
  {
    key: 'sourceNo',
    title: '来源单号',
    minWidth: 180,
    render: row => renderNullable(row.sourceNo)
  },
  {
    key: 'beforeStatusJson',
    title: '前状态',
    width: 100,
    render: row =>
      row.beforeStatusJson
        ? h(
            NButton,
            {
              size: 'small',
              tertiary: true,
              onClick: () => openJson('充值日志前状态', row.beforeStatusJson)
            },
            { default: () => '查看' }
          )
        : '--'
  },
  {
    key: 'afterStatusJson',
    title: '后状态',
    width: 100,
    render: row =>
      row.afterStatusJson
        ? h(
            NButton,
            {
              size: 'small',
              tertiary: true,
              onClick: () => openJson('充值日志后状态', row.afterStatusJson)
            },
            { default: () => '查看' }
          )
        : '--'
  }
]);

const batchParsedColumns = computed<NaiveUI.TableColumn<ParsedBatchRow>[]>(() => [
  {
    key: 'lineNo',
    title: '行号',
    width: 80
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
    key: 'faceValue',
    title: '充值金额',
    width: 110,
    render: row => formatAmountYuan(row.faceValue)
  },
  {
    key: 'productType',
    title: '产品类型',
    width: 110,
    render: row => row.productType || '自动匹配'
  },
  {
    key: 'rawLine',
    title: '原始内容',
    minWidth: 240
  }
]);

const batchResultColumns = computed<NaiveUI.TableColumn<BatchSubmitResult>[]>(() => [
  {
    key: 'lineNo',
    title: '行号',
    width: 80
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
    key: 'faceValue',
    title: '充值金额',
    width: 110,
    render: row => formatAmountYuan(row.faceValue)
  },
  {
    key: 'mainStatus',
    title: '主状态',
    width: 110,
    render: row =>
      h(NTag, { type: getStatusTagType(row.mainStatus), bordered: false }, { default: () => row.mainStatus })
  },
  {
    key: 'supplierStatus',
    title: '供应商状态',
    width: 120,
    render: row =>
      h(NTag, { type: getStatusTagType(row.supplierStatus), bordered: false }, { default: () => row.supplierStatus })
  },
  {
    key: 'message',
    title: '处理结果',
    minWidth: 200
  },
  {
    key: 'createdAt',
    title: '返回时间',
    minWidth: 160,
    render: row => formatDateTime(row.createdAt)
  }
]);

watch(
  () => props.section,
  section => {
    activeTab.value = section;
  },
  { immediate: true }
);

watch(
  () => route.query.orderNo,
  orderNo => {
    if (activeTab.value === 'events') {
      eventFilter.orderNo = typeof orderNo === 'string' ? orderNo : '';
    }
  },
  { immediate: true }
);

watch(
  activeTab,
  async tab => {
    if (tab === 'products' && !productLoaded.value) {
      await loadPortalProducts();
    }

    if (tab === 'orders' && !orders.value.length) {
      await loadOrders();
    }

    if (tab === 'recharges' && !rechargeLoaded.value) {
      await loadPortalRechargeLogs();
    }

    if (tab === 'events' && eventFilter.orderNo.trim()) {
      await loadOrderEvents();
    }
  },
  { immediate: true }
);

onMounted(() => {
  void initializePortal();
});

function getTabBadgeText(tab: TabKey) {
  switch (tab) {
    case 'batch':
      return batchRows.value.length ? `${batchRows.value.length} 条` : '导入';
    case 'products':
      return productPagination.itemCount ? `${productPagination.itemCount}` : '商品';
    case 'orders':
      return orderPagination.itemCount ? `${orderPagination.itemCount}` : '订单';
    case 'events':
      return eventRows.value.length ? `${eventRows.value.length}` : '日志';
    case 'recharges':
      return rechargeRecords.value.length ? `${rechargeRecords.value.length}` : '账务';
    case 'single':
      return singlePreview.value?.matched ? '已匹配' : '实时';
    default:
      return '总览';
  }
}

async function goToSection(tab: TabKey, query?: Record<string, string>) {
  activeTab.value = tab;
  await router.push({
    name: portalSectionRouteMap[tab],
    query
  });
}

async function initializePortal() {
  portalToken.value = getPortalToken();

  if (!portalToken.value) {
    await router.replace('/portal-login');
    return;
  }

  refreshAdminAccessState();
  initLoading.value = true;

  const { data, error } = await fetchGetPortalMe();

  if (error) {
    await handleInvalidPortalSession();
    return;
  }

  portalMe.value = data;
  await loadOverview();

  initLoading.value = false;
}

function refreshAdminAccessState() {
  adminTokenAvailable.value = Boolean(localStg.get('token'));
  adminAccessNote.value = adminTokenAvailable.value
    ? ''
    : '当前浏览器没有后台管理员令牌，余额、充值日志和后台商品接口会显示为只读提示。';
}

async function handleInvalidPortalSession() {
  clearPortalAuthStorage();
  portalToken.value = '';
  initLoading.value = false;
  window.$message?.warning('渠道登录状态已失效，请重新登录。');
  await router.replace('/portal-login');
}

async function handleLogout() {
  if (portalToken.value) {
    await fetchPortalLogout();
  }

  clearPortalAuthStorage();
  portalToken.value = '';
  window.$message?.success('已退出渠道门户');
  await router.replace('/portal-login');
}

async function loadOverview() {
  overviewLoading.value = true;
  refreshAdminAccessState();

  const [profileRes, quotaRes] = await Promise.all([fetchGetPortalChannelProfile(), fetchGetPortalChannelQuota()]);

  channelProfile.value = profileRes.error ? null : profileRes.data;
  channelQuota.value = quotaRes.error ? null : quotaRes.data;

  const channelId = portalMe.value?.channelId || channelProfile.value?.id;

  if (!adminTokenAvailable.value || !channelId) {
    channelBalance.value = null;
    balanceHint.value = '余额接口当前仅开放在后台管理员接口 /admin/channels/{channelId}/balance。';
    overviewLoading.value = false;
    return;
  }

  const { data, error } = await fetchGetPortalChannelBalance(channelId);

  if (error) {
    channelBalance.value = null;
    balanceHint.value = '余额接口访问失败，请确认后台管理员仍处于登录状态。';
  } else {
    channelBalance.value = data;
    balanceHint.value = '';
  }

  overviewLoading.value = false;
}

async function handlePreviewSingle() {
  const mobile = singleForm.mobile.trim();

  if (!/^\d{11}$/.test(mobile)) {
    window.$message?.warning('请输入正确的 11 位手机号');
    return;
  }

  if (!singleForm.faceValue || singleForm.faceValue <= 0) {
    window.$message?.warning('请输入正确的充值金额');
    return;
  }

  previewLoading.value = true;
  singlePreview.value = null;

  const previewResponse = await fetchPreviewPortalOrderSplit({
    mobile,
    faceValue: Number(singleForm.faceValue),
    productType: singleForm.productType || undefined
  });

  if (!previewResponse.error) {
    singlePreview.value = previewResponse.data;
    previewLoading.value = false;
    return;
  }

  if (getRequestStatus(previewResponse.error) !== 404) {
    previewLoading.value = false;
    window.$message?.error(getErrorMessage(previewResponse.error));
    return;
  }

  const customerResponse = await fetchGetPortalCustomerDetail(mobile);

  previewLoading.value = false;

  if (customerResponse.error) {
    singlePreview.value = createFallbackPreview(mobile, null);
    window.$message?.warning('预览拆单接口暂未开放，且号码归属信息查询失败。');
    return;
  }

  singlePreview.value = createFallbackPreview(mobile, resolveCustomerLookupItem(customerResponse.data));
  window.$message?.warning('预览拆单接口暂未开放，已降级展示号码归属信息。');
}

async function handleSubmitSingle() {
  const mobile = singleForm.mobile.trim();

  if (!/^\d{11}$/.test(mobile)) {
    window.$message?.warning('请输入正确的 11 位手机号');
    return;
  }

  if (!singleForm.faceValue || singleForm.faceValue <= 0) {
    window.$message?.warning('请输入正确的充值金额');
    return;
  }

  const ext = parseExtObject(singleForm.extText);

  if (ext === null) {
    return;
  }

  singleSubmitting.value = true;

  const { data, error } = await fetchCreatePortalOrder({
    channelOrderNo: singleForm.channelOrderNo.trim() || createPortalOrderNo('single'),
    mobile,
    faceValue: Number(singleForm.faceValue),
    product_type: singleForm.productType || undefined,
    ext
  });

  singleSubmitting.value = false;

  if (error) {
    window.$message?.error(getPortalSubmitErrorMessage(error));
    return;
  }

  selectedOrder.value = data;
  eventFilter.orderNo = data.orderNo;
  rechargeLoaded.value = true;
  focusSubmittedOrderLogs(data);
  openJson('单笔充值返回', data);
  window.$message?.success(`充值请求已提交，订单号：${data.orderNo}`);

  resetSingleForm();
  await goToSection('recharges');
  await loadPortalRechargeLogs();
}

function resetSingleForm() {
  Object.assign(singleForm, {
    channelOrderNo: createPortalOrderNo('single'),
    mobile: '',
    faceValue: null,
    productType: '',
    extText: ''
  });

  singlePreview.value = null;
}

async function downloadBatchTemplate() {
  batchTemplateLoading.value = true;

  const { data, error } = await fetchGetPortalBatchTemplate();

  batchTemplateLoading.value = false;

  if (error) {
    return;
  }

  try {
    await downloadTemplateWorkbook(data.fileName || 'batch-template.xlsx', data.content);
    window.$message?.success('批量模板已下载');
  } catch (downloadError) {
    window.$message?.error(getErrorMessage(downloadError));
  }
}

function triggerBatchFileDialog() {
  batchFileInputRef.value?.click();
}

async function handleBatchFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  try {
    batchForm.content = await readBatchFile(file);
    parseBatchContent();
    window.$message?.success(`已读取文件：${file.name}`);
  } catch (error) {
    window.$message?.error(getErrorMessage(error));
  } finally {
    input.value = '';
  }
}

function parseBatchContent() {
  const { rows, errors } = parseBatchText(batchForm.content);

  batchRows.value = rows;
  batchErrors.value = errors;

  if (errors.length) {
    window.$message?.warning(`已解析 ${rows.length} 行，存在 ${errors.length} 条格式问题`);
    return;
  }

  if (rows.length) {
    window.$message?.success(`已解析 ${rows.length} 条批量充值记录`);
  }
}

async function handleSubmitBatch() {
  if (!batchRows.value.length) {
    parseBatchContent();
  }

  if (!batchRows.value.length) {
    window.$message?.warning('请先粘贴或导入有效的批量充值数据');
    return;
  }

  if (batchErrors.value.length) {
    window.$message?.warning('请先修正批量数据中的格式问题');
    return;
  }

  batchSubmitting.value = true;
  batchResults.value = [];

  for (const row of batchRows.value) {
    const { data, error } = await fetchCreatePortalOrder({
      channelOrderNo: row.channelOrderNo,
      mobile: row.mobile,
      faceValue: row.faceValue,
      product_type: row.productType || undefined
    });

    if (error) {
      batchResults.value.push({
        lineNo: row.lineNo,
        channelOrderNo: row.channelOrderNo,
        mobile: row.mobile,
        faceValue: row.faceValue,
        productType: row.productType || 'AUTO',
        success: false,
        orderNo: '--',
        mainStatus: 'FAILED',
        supplierStatus: 'FAILED',
        message: getPortalSubmitErrorMessage(error),
        createdAt: new Date().toISOString()
      });

      continue;
    }

    batchResults.value.push({
      lineNo: row.lineNo,
      channelOrderNo: row.channelOrderNo,
      mobile: row.mobile,
      faceValue: row.faceValue,
      productType: row.productType || 'AUTO',
      success: true,
      orderNo: data.orderNo,
      mainStatus: data.mainStatus,
      supplierStatus: data.supplierStatus,
      message: '提交成功',
      createdAt: data.createdAt
    });
  }

  batchSubmitting.value = false;

  const successCount = batchResults.value.filter(item => item.success).length;
  window.$message?.success(`批量提交完成，成功 ${successCount} / ${batchResults.value.length}`);

  await goToSection('orders');
}

async function _loadProducts() {
  refreshAdminAccessState();
  productsLoading.value = true;
  productLoaded.value = true;
  productSourceLabel.value = '当前使用 /admin/products';

  if (!adminTokenAvailable.value) {
    syncedProductBaseRows.value = [];
    productRows.value = [];
    portalProductPool.value = [];
    productPagination.itemCount = 0;
    productsLoading.value = false;
    adminAccessNote.value = '商品列表已按需求切换为 /admin/products，请先登录后台管理员后再进入渠道门户查看。';
    return;
  }

  const portalResponse = await fetchGetPortalProducts();
  const portalRows = portalResponse.error ? [] : portalResponse.data.map(normalizePortalProduct);
  const { rows: adminRows, error: adminError } = await fetchAllAdminProductRows({
    carrierCode: productFilter.carrierCode || undefined,
    productType: productFilter.productType || undefined
  });

  productsLoading.value = false;

  if (adminError) {
    syncedProductBaseRows.value = [];
    productRows.value = [];
    portalProductPool.value = [];
    productPagination.itemCount = 0;
    adminAccessNote.value = '读取 /admin/products 失败，请确认后台管理员仍处于登录状态。';
    return;
  }

  syncedProductBaseRows.value = portalResponse.error
    ? adminRows.map(normalizeAdminProduct)
    : mergeProductSources(adminRows.map(normalizeAdminProduct), portalRows);

  if (portalResponse.error) {
    adminAccessNote.value = '商品列表已通过 /admin/products 加载，但门户售价、路由状态和拆单信息补齐失败。';
  } else {
    adminAccessNote.value = '';
  }

  applyProductFiltersAndSync();
}

function syncPortalProductPage() {
  const page = productPagination.page || 1;
  const pageSize = productPagination.pageSize || 10;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  productRows.value = portalProductPool.value.slice(start, end);
}

function applyProductFiltersAndSync() {
  portalProductPool.value = applyProductFilters(syncedProductBaseRows.value);
  productPagination.itemCount = portalProductPool.value.length;
  productPagination.page = 1;
  syncPortalProductPage();
}

function handleResetProductFilter() {
  Object.assign(productFilter, {
    keyword: '',
    carrierCode: null,
    province: '',
    faceValue: null,
    productType: '',
    status: ''
  });

  productPagination.page = 1;
  void loadPortalProducts();
}

async function loadOrders() {
  ordersLoading.value = true;

  const orderParams: Api.Portal.OrderQueryParams = {
    pageNum: orderPagination.page || 1,
    pageSize: orderPagination.pageSize || 10,
    ...cleanQuery({
      orderNo: orderFilter.orderNo.trim() || undefined,
      channelOrderNo: orderFilter.channelOrderNo.trim() || undefined,
      mobile: orderFilter.mobile.trim() || undefined,
      mainStatus: orderFilter.mainStatus.trim() || undefined,
      supplierStatus: orderFilter.supplierStatus.trim() || undefined,
      refundStatus: orderFilter.refundStatus.trim() || undefined,
      startTime: orderDateRange.value ? dayjs(orderDateRange.value[0]).toISOString() : undefined,
      endTime: orderDateRange.value ? dayjs(orderDateRange.value[1]).toISOString() : undefined
    })
  };

  const { data, error } = await fetchGetPortalOrders(orderParams);

  ordersLoading.value = false;

  if (error) {
    orders.value = [];
    orderPagination.itemCount = 0;
    return;
  }

  orders.value = data.records;
  orderPagination.itemCount = data.total;

  if (selectedOrder.value) {
    const matched = data.records.find(item => item.orderNo === selectedOrder.value?.orderNo);

    if (matched) {
      selectedOrder.value = matched;
    }
  }
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

async function handleViewEvents(order: Api.Portal.OrderItem) {
  selectedOrder.value = order;
  eventFilter.orderNo = order.orderNo;
  eventPagination.page = 1;
  await goToSection('events', { orderNo: order.orderNo });
}

async function loadOrderEvents() {
  const orderNo = eventFilter.orderNo.trim();

  if (!orderNo) {
    eventRows.value = [];
    eventDisplayRows.value = [];
    eventPagination.itemCount = 0;
    return;
  }

  eventsLoading.value = true;

  const { data, error } = await fetchGetPortalOrderEvents(
    orderNo,
    cleanQuery({
      pageNum: eventPagination.page || 1,
      pageSize: eventPagination.pageSize || 10,
      startTime: eventDateRange.value ? dayjs(eventDateRange.value[0]).toISOString() : undefined,
      endTime: eventDateRange.value ? dayjs(eventDateRange.value[1]).toISOString() : undefined,
      sortBy: 'occurredAt',
      sortOrder: eventFilter.sortOrder
    })
  );

  eventsLoading.value = false;

  if (error) {
    eventRows.value = [];
    eventDisplayRows.value = [];
    eventPagination.itemCount = 0;
    return;
  }

  eventRows.value = Array.isArray(data) ? data : data.records;
  eventPagination.page = 1;
  eventPagination.itemCount = eventRows.value.length;
  syncEventPage();

  const matchedOrder = orders.value.find(item => item.orderNo === orderNo);

  if (matchedOrder) {
    selectedOrder.value = matchedOrder;
  }
}

function syncEventPage() {
  const page = eventPagination.page || 1;
  const pageSize = eventPagination.pageSize || 10;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  eventDisplayRows.value = eventRows.value.slice(start, end);
}

function handleResetEventFilter() {
  Object.assign(eventFilter, {
    orderNo: '',
    sortOrder: 'desc'
  });
  eventDateRange.value = null;
  eventRows.value = [];
  eventDisplayRows.value = [];
  eventPagination.page = 1;
  eventPagination.itemCount = 0;
}

async function _loadRechargeRecords() {
  refreshAdminAccessState();
  rechargeLoaded.value = true;

  const channelId = portalMe.value?.channelId || channelProfile.value?.id;

  if (!adminTokenAvailable.value || !channelId) {
    rechargeRecords.value = [];
    rechargeHint.value = '充值日志当前仅开放在后台管理员接口 /admin/channels/{channelId}/recharge-records。';
    return;
  }

  rechargeLoading.value = true;

  const { data, error } = await fetchGetPortalRechargeRecords(channelId);

  rechargeLoading.value = false;

  if (error) {
    rechargeRecords.value = [];
    rechargeHint.value = '充值日志读取失败，请确认后台管理员仍处于登录状态。';
    return;
  }

  rechargeRecords.value = data;
  rechargeHint.value = '';
}

function openJson(title: string, data: unknown) {
  jsonModalTitle.value = title;
  jsonModalData.value = data;
  jsonModalVisible.value = true;
}

function _exportProducts() {
  if (!productRows.value.length) {
    window.$message?.warning('当前没有可导出的商品数据');
    return;
  }

  downloadCsv('portal-products.csv', [
    ['商品名称', '商品编码', '运营商', '归属省份', '面值', '售价', '产品类型', '状态', '来源'],
    ...productRows.value.map(item => [
      item.productName,
      item.productCode,
      `${item.operator} (${item.carrierCode})`,
      item.provinceName,
      item.faceValueFen / 100,
      (item.salePriceFen ?? item.faceValueFen) / 100,
      item.productType,
      item.status,
      item.sourceLabel
    ])
  ]);
}

function exportOrders() {
  if (!orders.value.length) {
    window.$message?.warning('当前没有可导出的消费记录');
    return;
  }

  downloadCsv('portal-orders.csv', [
    [
      '平台订单号',
      '渠道订单号',
      '手机号',
      '归属地',
      '运营商',
      '充值金额',
      '产品类型',
      '主状态',
      '供应商状态',
      '创建时间'
    ],
    ...orders.value.map(item => [
      item.orderNo,
      item.channelOrderNo,
      item.mobile,
      item.province || '',
      item.ispName || '',
      item.faceValue,
      item.requestedProductType,
      item.mainStatus,
      item.supplierStatus,
      formatDateTime(item.createdAt)
    ])
  ]);
}

function exportEvents() {
  if (!eventRows.value.length) {
    window.$message?.warning('当前没有可导出的消费日志');
    return;
  }

  downloadCsv('portal-order-events.csv', [
    ['事件类型', '来源单号', '前状态', '后状态', '发生时间'],
    ...eventRows.value.map(item => [
      item.eventType,
      item.sourceNo || '',
      stringifyJson(item.beforeStatusJson),
      stringifyJson(item.afterStatusJson),
      formatDateTime(item.occurredAt)
    ])
  ]);
}

function _exportRechargeRecords() {
  if (!rechargeRecords.value.length) {
    window.$message?.warning('当前没有可导出的充值日志');
    return;
  }

  downloadCsv('portal-recharge-records.csv', [
    ['流水号', '充值金额', '充值前余额', '充值后余额', '来源', '操作人', '备注', '创建时间'],
    ...rechargeRecords.value.map(item => [
      item.recordId,
      item.amountFen / 100,
      item.beforeBalanceFen / 100,
      item.afterBalanceFen / 100,
      item.recordSource,
      item.operatorUsername || '',
      item.remark || '',
      formatDateTime(item.createdAt)
    ])
  ]);
}

async function loadPortalProducts() {
  refreshAdminAccessState();
  productsLoading.value = true;
  productLoaded.value = true;

  const portalQuery = cleanQuery({
    carrierCode: productFilter.carrierCode || undefined,
    province: productFilter.province.trim() || undefined,
    faceValue: productFilter.faceValue || undefined,
    productType: productFilter.productType || undefined,
    status: productFilter.status.trim() || undefined
  });

  const portalResponse = await fetchGetPortalProducts(portalQuery);
  const portalRows = portalResponse.error ? [] : portalResponse.data.map(normalizePortalProduct);

  productSourceLabel.value = '当前使用 /open-api/products';

  if (!adminTokenAvailable.value) {
    productsLoading.value = false;

    if (portalResponse.error) {
      syncedProductBaseRows.value = [];
      portalProductPool.value = [];
      productRows.value = [];
      productPagination.itemCount = 0;
      adminAccessNote.value = '商品列表读取失败，请确认渠道门户登录状态有效后再重试。';
      return;
    }

    syncedProductBaseRows.value = portalRows;
    adminAccessNote.value = '当前展示渠道可售商品；如同时登录后台管理员，可补齐商品编码、销售单位与后台商品状态。';
    applyProductFiltersAndSync();
    return;
  }

  const { rows: adminRows, error: adminError } = await fetchAllAdminProductRows({
    carrierCode: productFilter.carrierCode || undefined,
    productType: productFilter.productType || undefined
  });

  productsLoading.value = false;

  if (!portalResponse.error && !adminError) {
    syncedProductBaseRows.value = mergePortalProductSources(portalRows, adminRows.map(normalizeAdminProduct));
    productSourceLabel.value = '当前使用 /open-api/products + /admin/products';
    adminAccessNote.value = '';
    applyProductFiltersAndSync();
    return;
  }

  if (!portalResponse.error) {
    syncedProductBaseRows.value = portalRows;
    adminAccessNote.value = '后台商品信息补齐失败，当前已降级展示渠道可售商品视图。';
    applyProductFiltersAndSync();
    return;
  }

  if (!adminError) {
    syncedProductBaseRows.value = adminRows.map(normalizeAdminProduct);
    productSourceLabel.value = '当前使用 /admin/products';
    adminAccessNote.value = '渠道可售商品接口读取失败，当前仅展示后台商品目录，路由状态和拆单能力可能不完整。';
    applyProductFiltersAndSync();
    return;
  }

  syncedProductBaseRows.value = [];
  portalProductPool.value = [];
  productRows.value = [];
  productPagination.itemCount = 0;
  adminAccessNote.value = '商品列表读取失败，请稍后重试。';
}

function exportPortalProducts() {
  if (!productRows.value.length) {
    window.$message?.warning('当前没有可导出的商品数据');
    return;
  }

  downloadCsv('portal-products.csv', [
    [
      '商品名称',
      '商品编码',
      '运营商',
      '省份',
      '面值',
      '售价',
      '产品类型',
      '销售单位',
      '商品状态',
      '路由状态',
      '支持拆单',
      '到账时效',
      '来源'
    ],
    ...productRows.value.map(item => [
      item.productName,
      item.productCode,
      `${item.operator} (${item.carrierCode})`,
      item.provinceName,
      item.faceValueFen / 100,
      (item.salePriceFen ?? item.faceValueFen) / 100,
      item.productType || '',
      item.salesUnit || '',
      item.status,
      item.routeStatus,
      renderBoolean(item.splitSupport),
      item.arrivalSla || '',
      item.sourceLabel
    ])
  ]);
}

function handleResetRechargeLogFilter() {
  Object.assign(rechargeFilter, {
    orderNo: '',
    channelOrderNo: '',
    mobile: '',
    mainStatus: '',
    supplierStatus: '',
    refundStatus: ''
  });
  rechargeDateRange.value = null;
  void loadPortalRechargeLogs();
}

async function loadPortalRechargeLogs() {
  rechargeLoaded.value = true;
  rechargeLoading.value = true;

  const orderParams: Api.Portal.OrderQueryParams = {
    pageNum: 1,
    pageSize: 50,
    ...cleanQuery({
      orderNo: rechargeFilter.orderNo.trim() || undefined,
      channelOrderNo: rechargeFilter.channelOrderNo.trim() || undefined,
      mobile: rechargeFilter.mobile.trim() || undefined,
      mainStatus: rechargeFilter.mainStatus.trim() || undefined,
      supplierStatus: rechargeFilter.supplierStatus.trim() || undefined,
      refundStatus: rechargeFilter.refundStatus.trim() || undefined,
      startTime: rechargeDateRange.value ? dayjs(rechargeDateRange.value[0]).toISOString() : undefined,
      endTime: rechargeDateRange.value ? dayjs(rechargeDateRange.value[1]).toISOString() : undefined
    })
  };

  const { data, error } = await fetchGetPortalOrders(orderParams);

  if (error) {
    rechargeLoading.value = false;
    rechargeRecords.value = [];
    rechargeHint.value = '充值日志读取失败，请稍后重试。';
    return;
  }

  if (!data.records.length) {
    rechargeLoading.value = false;
    rechargeRecords.value = [];
    rechargeHint.value = '当前筛选条件下暂无充值日志。';
    return;
  }

  const eventQuery = cleanQuery({
    pageNum: 1,
    pageSize: 50,
    startTime: rechargeDateRange.value ? dayjs(rechargeDateRange.value[0]).toISOString() : undefined,
    endTime: rechargeDateRange.value ? dayjs(rechargeDateRange.value[1]).toISOString() : undefined,
    sortBy: 'occurredAt',
    sortOrder: 'desc' as Api.Portal.SortOrder
  });

  let partialEventFailed = false;

  const logGroups = await Promise.all(
    data.records.map(async order => {
      const submitLog = createRechargeSubmitLog(order);
      const eventRes = await fetchGetPortalOrderEvents(order.orderNo, eventQuery);

      if (eventRes.error) {
        partialEventFailed = true;
        return [submitLog];
      }

      const eventItems = Array.isArray(eventRes.data) ? eventRes.data : eventRes.data.records;

      if (!eventItems.length) {
        return [submitLog];
      }

      return [submitLog, ...eventItems.map((item, index) => createRechargeEventLog(order, item, index))];
    })
  );

  rechargeLoading.value = false;
  rechargeRecords.value = logGroups.flat().sort((a: RechargeLogRow, b: RechargeLogRow) => {
    return dayjs(b.occurredAt).valueOf() - dayjs(a.occurredAt).valueOf();
  });
  rechargeHint.value = partialEventFailed
    ? '部分订单事件读取失败，已优先展示订单提交日志。'
    : `已展示最近 ${data.records.length} 笔匹配订单的提交与状态日志。`;
}

function createRechargeSubmitLog(order: Api.Portal.OrderItem): RechargeLogRow {
  return {
    id: `${order.orderNo}-submit`,
    logType: 'SUBMIT',
    eventType: 'ORDER_SUBMITTED',
    orderNo: order.orderNo,
    channelOrderNo: order.channelOrderNo,
    mobile: order.mobile,
    faceValue: order.faceValue,
    currency: order.currency,
    productType: order.requestedProductType,
    mainStatus: order.mainStatus,
    supplierStatus: order.supplierStatus,
    sourceNo: order.orderNo,
    beforeStatusJson: null,
    afterStatusJson: {
      mainStatus: order.mainStatus,
      supplierStatus: order.supplierStatus,
      refundStatus: order.refundStatus,
      notifyStatus: order.notifyStatus
    },
    occurredAt: order.createdAt
  };
}

function createRechargeEventLog(
  order: Api.Portal.OrderItem,
  event: Api.Portal.OrderEvent,
  index: number
): RechargeLogRow {
  return {
    id: `${order.orderNo}-event-${index}-${event.occurredAt}`,
    logType: 'EVENT',
    eventType: event.eventType,
    orderNo: order.orderNo,
    channelOrderNo: order.channelOrderNo,
    mobile: order.mobile,
    faceValue: order.faceValue,
    currency: order.currency,
    productType: order.requestedProductType,
    mainStatus: order.mainStatus,
    supplierStatus: order.supplierStatus,
    sourceNo: event.sourceNo,
    beforeStatusJson: event.beforeStatusJson,
    afterStatusJson: event.afterStatusJson,
    occurredAt: event.occurredAt
  };
}

function exportPortalRechargeLogs() {
  if (!rechargeRecords.value.length) {
    window.$message?.warning('当前没有可导出的充值日志');
    return;
  }

  downloadCsv('portal-recharge-logs.csv', [
    [
      '发生时间',
      '日志类型',
      '事件类型',
      '平台订单号',
      '渠道订单号',
      '手机号',
      '充值金额',
      '产品类型',
      '主状态',
      '供应商状态',
      '来源单号',
      '前状态',
      '后状态'
    ],
    ...rechargeRecords.value.map((item: RechargeLogRow) => [
      formatDateTime(item.occurredAt),
      item.logType === 'SUBMIT' ? '订单提交' : '状态事件',
      item.eventType,
      item.orderNo,
      item.channelOrderNo,
      item.mobile,
      item.faceValue,
      item.productType,
      item.mainStatus,
      item.supplierStatus,
      item.sourceNo || '',
      stringifyJson(item.beforeStatusJson),
      stringifyJson(item.afterStatusJson)
    ])
  ]);
}

function exportBatchResults() {
  if (!batchResults.value.length) {
    window.$message?.warning('当前没有可导出的批量充值结果');
    return;
  }

  downloadCsv('portal-batch-results.csv', [
    [
      '行号',
      '渠道订单号',
      '手机号',
      '充值金额',
      '产品类型',
      '平台订单号',
      '主状态',
      '供应商状态',
      '处理结果',
      '返回时间'
    ],
    ...batchResults.value.map(item => [
      item.lineNo,
      item.channelOrderNo,
      item.mobile,
      item.faceValue,
      item.productType,
      item.orderNo,
      item.mainStatus,
      item.supplierStatus,
      item.message,
      formatDateTime(item.createdAt)
    ])
  ]);
}

async function fetchAllAdminProductRows(query?: Partial<Api.Portal.AdminProductQueryParams>) {
  const rows: Api.Portal.AdminProductItem[] = [];
  const pageSize = 100;
  let pageNum = 1;

  while (true) {
    const { data, error } = await fetchGetAdminProducts({
      ...cleanQuery(query || {}),
      pageNum,
      pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });

    if (error) {
      return {
        rows: [],
        error
      };
    }

    rows.push(...data.records);

    if (pageNum >= data.totalPages || !data.records.length) {
      break;
    }

    pageNum += 1;
  }

  return {
    rows,
    error: null as null
  };
}

function normalizeAdminProduct(item: Api.Portal.AdminProductItem): ProductRow {
  return {
    id: item.id,
    productCode: item.productCode,
    productName: item.productName,
    carrierCode: item.carrierCode,
    operator: getCarrierLabel(item.carrierCode),
    provinceName: item.provinceName,
    faceValueFen: item.faceValueAmountFen,
    salePriceFen: item.faceValueAmountFen,
    productType: item.productType,
    status: item.status,
    routeStatus: item.status,
    splitSupport: null,
    arrivalSla: null,
    salesUnit: item.salesUnit,
    sourceLabel: '后台商品'
  };
}

function normalizePortalProduct(item: Api.Portal.OpenProductItem): ProductRow {
  const productType = inferProductType(`${item.productId} ${item.productName}`);

  return {
    id: item.productId,
    productCode: item.productId,
    productName: item.productName,
    carrierCode: item.carrierCode,
    operator: item.operator || getCarrierLabel(item.carrierCode),
    provinceName: inferProvinceFromProductName(item.productName),
    faceValueFen: item.faceValueFen,
    salePriceFen: item.salePriceFen,
    productType,
    status: item.routeStatus,
    routeStatus: item.routeStatus,
    splitSupport: item.splitSupport,
    arrivalSla: item.arrivalSla,
    salesUnit: '元',
    sourceLabel: '门户商品'
  };
}

function mergeProductSources(adminRows: ProductRow[], portalRows: ProductRow[]) {
  const portalRowMap = createProductMatchMap(portalRows);
  const matchedPortalIds = new Set<string>();

  const mergedAdminRows = adminRows.map(adminRow => {
    const portalRow = findMatchedPortalProduct(adminRow, portalRowMap);

    if (!portalRow) {
      return {
        ...adminRow,
        salePriceFen: null,
        routeStatus: 'NOT_SYNCED',
        sourceLabel: '后台同步（未在渠道开放）'
      };
    }

    matchedPortalIds.add(portalRow.id);

    return {
      ...adminRow,
      operator: portalRow.operator || adminRow.operator,
      provinceName: adminRow.provinceName || portalRow.provinceName,
      salePriceFen: portalRow.salePriceFen,
      status: portalRow.status || adminRow.status,
      routeStatus: portalRow.routeStatus || adminRow.routeStatus,
      splitSupport: portalRow.splitSupport,
      arrivalSla: portalRow.arrivalSla,
      sourceLabel: '后台同步（已补齐渠道信息）'
    };
  });

  const portalOnlyRows = portalRows
    .filter(item => !matchedPortalIds.has(item.id))
    .map(item => ({
      ...item,
      sourceLabel: '门户商品（后台未匹配）'
    }));

  return [...mergedAdminRows, ...portalOnlyRows];
}

function mergePortalProductSources(portalRows: ProductRow[], adminRows: ProductRow[]) {
  const adminRowMap = createProductMatchMap(adminRows);

  return portalRows.map(portalRow => {
    const adminRow = findMatchedPortalProduct(portalRow, adminRowMap);

    if (!adminRow) {
      return {
        ...portalRow,
        sourceLabel: '渠道可售商品'
      };
    }

    return {
      ...portalRow,
      productCode: adminRow.productCode || portalRow.productCode,
      provinceName: adminRow.provinceName || portalRow.provinceName,
      productType: adminRow.productType || portalRow.productType,
      salesUnit: adminRow.salesUnit || portalRow.salesUnit,
      status: adminRow.status || portalRow.status,
      sourceLabel: '渠道可售商品（已补齐后台字段）'
    };
  });
}

function createProductMatchMap(rows: ProductRow[]) {
  const map = new Map<string, ProductRow>();

  rows.forEach(row => {
    createProductMatchKeys(row).forEach(key => {
      if (!map.has(key)) {
        map.set(key, row);
      }
    });
  });

  return map;
}

function findMatchedPortalProduct(row: ProductRow, portalRowMap: Map<string, ProductRow>) {
  for (const key of createProductMatchKeys(row)) {
    const matchedRow = portalRowMap.get(key);

    if (matchedRow) {
      return matchedRow;
    }
  }

  return null;
}

function createProductMatchKeys(row: ProductRow) {
  const normalizedId = normalizeProductKey(row.id);
  const normalizedCode = normalizeProductKey(row.productCode);
  const normalizedName = normalizeProductKey(row.productName);
  const normalizedCarrier = normalizeProductKey(row.carrierCode);
  const normalizedProvince = normalizeProvinceKey(row.provinceName);
  const normalizedProductType = normalizeProductTypeKey(row.productType);

  return [
    normalizedId ? `id:${normalizedId}` : '',
    normalizedCode ? `code:${normalizedCode}` : '',
    normalizedProvince
      ? `carrier-face-province-type:${normalizedCarrier}|${row.faceValueFen}|${normalizedProvince}|${normalizedProductType}`
      : '',
    `carrier-face-type:${normalizedCarrier}|${row.faceValueFen}|${normalizedProductType}`,
    normalizedName ? `name:${normalizedName}|${normalizedCarrier}|${row.faceValueFen}` : ''
  ].filter(Boolean);
}

function normalizeProductKey(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function normalizeProvinceKey(value?: string | null) {
  const normalized = normalizeProductKey(value);

  if (!normalized || normalized === '--') {
    return '';
  }

  return normalized;
}

function normalizeProductTypeKey(value?: string | null) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();

  return normalized || 'AUTO';
}

function applyProductFilters(rows: ProductRow[]) {
  const keyword = productFilter.keyword.trim().toLowerCase();
  const province = productFilter.province.trim().toLowerCase();
  const status = productFilter.status.trim().toLowerCase();
  const faceValueFen = productFilter.faceValue ? Number(productFilter.faceValue) * 100 : null;

  return rows.filter(item => {
    const text = [item.productName, item.productCode, item.operator, item.provinceName].join(' ').toLowerCase();
    const matchedKeyword = !keyword || text.includes(keyword);
    const matchedCarrier = !productFilter.carrierCode || item.carrierCode === productFilter.carrierCode;
    const matchedProvince = !province || item.provinceName.toLowerCase().includes(province);
    const matchedFaceValue = faceValueFen === null || item.faceValueFen === faceValueFen;
    const matchedProductType = !productFilter.productType || item.productType === productFilter.productType;
    const matchedStatus =
      !status ||
      item.status.toLowerCase().includes(status) ||
      item.routeStatus.toLowerCase().includes(status) ||
      item.sourceLabel.toLowerCase().includes(status);

    return (
      matchedKeyword && matchedCarrier && matchedProvince && matchedFaceValue && matchedProductType && matchedStatus
    );
  });
}

function parseExtObject(text: string) {
  const content = text.trim();

  if (!content) {
    return undefined;
  }

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    window.$message?.warning('扩展参数不是合法 JSON，请检查后再提交');
    return null;
  }
}

function renderBoolean(value?: boolean | null) {
  if (value === null || value === undefined) {
    return '--';
  }

  return value ? '是' : '否';
}

function cleanQuery<T extends Record<string, unknown>>(params: T) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  ) as Partial<T>;
}

function getErrorMessage(error: unknown) {
  if (!error) {
    return '请求失败';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const responseData = getResponseData(error);

    if (typeof responseData === 'string' && responseData.trim()) {
      return responseData.trim();
    }

    if (responseData && typeof responseData === 'object') {
      const responseRecord = responseData as Record<string, unknown>;

      if (typeof responseRecord.message === 'string') {
        return responseRecord.message;
      }

      if (typeof responseRecord.msg === 'string') {
        return responseRecord.msg;
      }
    }

    if (typeof record.message === 'string') {
      return record.message;
    }

    if (typeof record.msg === 'string') {
      return record.msg;
    }
  }

  return '请求失败';
}

function getResponseData(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const response = (error as { response?: { data?: unknown } }).response;

  return response?.data ?? null;
}

function getRequestStatus(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const response = (error as { response?: { status?: number } }).response;

  return typeof response?.status === 'number' ? response.status : null;
}

function resolveCustomerLookupItem(
  data: Api.Portal.CustomerDetailResult | null | undefined
): Api.Portal.CustomerLookupItem | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if ('records' in data && Array.isArray(data.records) && data.records.length > 0) {
    return data.records[0];
  }

  if ('basicInfo' in data && data.basicInfo) {
    return data.basicInfo;
  }

  if ('mobile' in data && typeof data.mobile === 'string') {
    return {
      mobile: data.mobile,
      province: data.province ?? null,
      ispName: data.ispName ?? null
    };
  }

  return null;
}

function getPortalSubmitErrorMessage(error: unknown) {
  const status = getRequestStatus(error);

  if (status === 404) {
    return '单笔充值接口返回 404。已核对 api.json 与前端提交字段，线上接口地址存在，请先重启本地前端并确认请求是否经过 /proxy-default 代理。';
  }

  if (status === 401) {
    return '单笔充值接口已存在，但当前鉴权失败。请重新登录渠道门户，并确认后端网关是否正确识别门户 token / AccessKey。';
  }

  if (status === 400) {
    return '单笔充值接口已存在，但后端返回 400。请检查门户鉴权、网关转发，以及请求体是否按 application/json 透传。';
  }

  return getErrorMessage(error);
}

function focusSubmittedOrderLogs(order: Api.Portal.OrderItem) {
  rechargeFilter.orderNo = order.orderNo;
  rechargeFilter.channelOrderNo = order.channelOrderNo;
  rechargeFilter.mobile = order.mobile;
  rechargeFilter.mainStatus = '';
  rechargeFilter.supplierStatus = '';
  rechargeFilter.refundStatus = '';
  rechargeDateRange.value = null;
}

function createFallbackPreview(
  mobile: string,
  customer: Api.Portal.CustomerLookupItem | null
): Api.Portal.OrderPreviewResult {
  return {
    matched: false,
    unmatchedReason: '预览拆单接口暂未开放，已降级展示号码归属信息，拆单结果请以下单返回为准。',
    usedSplit: false,
    supplierId: null,
    mobile,
    province: customer?.province ?? null,
    ispName: customer?.ispName ?? null,
    pieces: []
  };
}
</script>

<template>
  <NSpin :show="initLoading">
    <div class="space-y-16px portal-page">
      <NAlert v-if="adminAccessNote" type="warning" :show-icon="false">
        {{ adminAccessNote }}
      </NAlert>

      <NCard :bordered="false" class="portal-header-card">
        <div class="portal-header-card__main">
          <div class="portal-header-card__eyebrow">渠道门户</div>
          <div class="portal-header-card__title">{{ activeTabMeta.label }}</div>
          <div class="portal-header-card__desc">
            采用左侧导航栏、顶部操作栏与主体内容区的经典后台管理架构，适配日常运营、商品维护与订单排查场景。
          </div>
        </div>

        <div class="portal-header-card__meta">
          <span>渠道名称：{{ currentChannelName }}</span>
          <span>渠道编码：{{ currentChannelCode }}</span>
          <span>协议：{{ currentProtocolType }}</span>
          <span>状态：{{ currentStatus }}</span>
        </div>

        <div class="portal-header-card__actions">
          <NButton :loading="overviewLoading" @click="loadOverview">刷新概览</NButton>
          <NButton v-if="activeTab === 'products'" :loading="productsLoading" @click="loadPortalProducts">
            刷新商品
          </NButton>
          <NButton v-if="activeTab === 'orders'" :loading="ordersLoading" @click="loadOrders">刷新记录</NButton>
          <NButton v-if="activeTab === 'events'" :loading="eventsLoading" @click="loadOrderEvents">刷新日志</NButton>
          <NButton v-if="activeTab === 'recharges'" :loading="rechargeLoading" @click="loadPortalRechargeLogs">
            刷新充值日志
          </NButton>
          <NButton type="error" tertiary @click="handleLogout">退出登录</NButton>
        </div>
      </NCard>

      <NGrid v-if="activeTab === 'overview'" cols="1 xl:3" :x-gap="16" :y-gap="16">
        <NGi>
          <NCard :bordered="false" class="summary-card" title="基础概览">
            <NDescriptions label-placement="left" bordered :column="1" size="small">
              <NDescriptionsItem label="联系人">{{ renderNullable(channelProfile?.contactName) }}</NDescriptionsItem>
              <NDescriptionsItem label="联系电话">{{ renderNullable(channelProfile?.contactPhone) }}</NDescriptionsItem>
              <NDescriptionsItem label="联系邮箱">{{ renderNullable(channelProfile?.contactEmail) }}</NDescriptionsItem>
              <NDescriptionsItem label="接口地址">{{ renderNullable(channelProfile?.baseUrl) }}</NDescriptionsItem>
              <NDescriptionsItem label="门户登录账号">
                {{ renderNullable(channelProfile?.accessAccount) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="消费日志">
                {{ renderBoolean(channelProfile?.supportsConsumptionLog) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="角色列表">{{ roleCodeText }}</NDescriptionsItem>
              <NDescriptionsItem label="权限列表">{{ permissionText }}</NDescriptionsItem>
            </NDescriptions>
          </NCard>
        </NGi>

        <NGi>
          <NCard :bordered="false" class="summary-card" title="额度规则">
            <NDescriptions label-placement="left" bordered :column="1" size="small">
              <NDescriptionsItem label="单笔限额">
                {{ formatFen(channelQuota?.limitRule?.singleLimitAmountFen) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="日限额">
                {{ formatFen(channelQuota?.limitRule?.dailyLimitAmountFen) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="月限额">
                {{ formatFen(channelQuota?.limitRule?.monthlyLimitAmountFen) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="QPS 限流">{{ channelQuota?.limitRule?.qpsLimit ?? '--' }}</NDescriptionsItem>
              <NDescriptionsItem label="结算模式">
                {{ renderNullable(channelProfile?.settlementMode) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="更新时间">{{ formatDateTime(channelProfile?.updatedAt) }}</NDescriptionsItem>
            </NDescriptions>
          </NCard>
        </NGi>

        <NGi>
          <NCard :bordered="false" class="summary-card" title="余额概览">
            <div class="space-y-12px">
              <div class="text-28px font-700 text-[#0f172a]">
                {{ formatFen(channelBalance?.availableBalanceFen, channelBalance?.currency) }}
              </div>
              <div>
                <NTag :type="getStatusTagType(channelBalance?.status)" :bordered="false">
                  {{ channelBalance?.status || 'UNKNOWN' }}
                </NTag>
              </div>
              <div class="space-y-6px text-13px text-[#64748b]">
                <div>冻结余额：{{ formatFen(channelBalance?.frozenBalanceFen, channelBalance?.currency) }}</div>
                <div>币种：{{ channelBalance?.currency || '--' }}</div>
                <div>查询时间：{{ formatDateTime(channelBalance?.updatedAt) }}</div>
              </div>
              <NAlert v-if="balanceHint" type="warning" :show-icon="false">
                {{ balanceHint }}
              </NAlert>
            </div>
          </NCard>
        </NGi>
      </NGrid>

      <NCard :bordered="false" class="content-card">
        <div class="content-card__hero">
          <div>
            <div class="content-card__eyebrow">渠道工作台</div>
            <div class="content-card__title">{{ activeTabMeta.label }}</div>
            <div class="content-card__desc">{{ activeTabMeta.description }}</div>
          </div>
          <div class="content-card__meta">
            <span class="content-card__badge">{{ getTabBadgeText(activeTab) }}</span>
            <span class="content-card__summary">左侧菜单负责切换功能，页面主体专注展示当前模块内容。</span>
          </div>
        </div>

        <NTabs v-model:value="activeTab" class="portal-tabs" type="line" animated>
          <NTabPane v-for="tab in tabOptions" :key="tab.name" :name="tab.name">
            <template v-if="tab.name === 'overview'">
              <NGrid cols="1 xl:2" :x-gap="16" :y-gap="16">
                <NGi>
                  <NCard embedded title="渠道详细信息">
                    <NDescriptions label-placement="left" bordered :column="1">
                      <NDescriptionsItem label="渠道 ID">{{ renderNullable(channelProfile?.id) }}</NDescriptionsItem>
                      <NDescriptionsItem label="渠道编码">{{ currentChannelCode }}</NDescriptionsItem>
                      <NDescriptionsItem label="渠道名称">{{ currentChannelName }}</NDescriptionsItem>
                      <NDescriptionsItem label="渠道类型">
                        {{ renderNullable(channelProfile?.channelType) }}
                      </NDescriptionsItem>
                      <NDescriptionsItem label="协议类型">{{ currentProtocolType }}</NDescriptionsItem>
                      <NDescriptionsItem label="合作状态">
                        {{ renderNullable(channelProfile?.cooperationStatus) }}
                      </NDescriptionsItem>
                      <NDescriptionsItem label="门户状态">{{ currentStatus }}</NDescriptionsItem>
                      <NDescriptionsItem label="门户登录账号">
                        {{ renderNullable(channelProfile?.accessAccount) }}
                      </NDescriptionsItem>
                      <NDescriptionsItem label="门户登录密码">
                        {{ renderNullable(channelProfile?.accessPassword) }}
                      </NDescriptionsItem>
                      <NDescriptionsItem label="角色列表">{{ roleCodeText }}</NDescriptionsItem>
                      <NDescriptionsItem label="权限列表">{{ permissionText }}</NDescriptionsItem>
                      <NDescriptionsItem label="备注">{{ renderNullable(channelProfile?.remark) }}</NDescriptionsItem>
                    </NDescriptions>
                  </NCard>
                </NGi>

                <NGi>
                  <NCard embedded title="渠道详情原始 JSON">
                    <NScrollbar class="max-h-520px">
                      <NCode :code="overviewJson" language="json" show-line-numbers />
                    </NScrollbar>
                  </NCard>
                </NGi>
              </NGrid>
            </template>

            <template v-else-if="tab.name === 'single'">
              <NGrid cols="1 xl:2" :x-gap="16" :y-gap="16">
                <NGi>
                  <NCard embedded title="单笔充值">
                    <NSpace vertical :size="16">
                      <NAlert type="info" :show-icon="false">
                        输入手机号和充值金额后，先调用 `/open-api/orders/preview-split`
                        预览运营商、省份和拆单结果，再发起充值。
                      </NAlert>

                      <NForm label-placement="left" label-width="92">
                        <NGrid cols="1 s:2" :x-gap="16" :y-gap="8">
                          <NGi span="2">
                            <NFormItem label="渠道订单号">
                              <NInput
                                v-model:value="singleForm.channelOrderNo"
                                placeholder="请输入渠道订单号"
                                :input-props="{
                                  id: 'portal-single-channel-order-no',
                                  name: 'channelOrderNo',
                                  'aria-label': '渠道订单号'
                                }"
                              />
                            </NFormItem>
                          </NGi>
                          <NGi>
                            <NFormItem label="手机号">
                              <NInput
                                v-model:value="singleForm.mobile"
                                placeholder="请输入 11 位手机号"
                                :input-props="{ id: 'portal-single-mobile', name: 'mobile', 'aria-label': '手机号' }"
                              />
                            </NFormItem>
                          </NGi>
                          <NGi>
                            <NFormItem label="充值金额">
                              <NInputNumber
                                v-model:value="singleForm.faceValue"
                                class="w-full"
                                :min="1"
                                placeholder="请输入金额"
                                :input-props="{
                                  id: 'portal-single-face-value',
                                  name: 'faceValue',
                                  'aria-label': '充值金额'
                                }"
                              />
                            </NFormItem>
                          </NGi>
                          <NGi span="2">
                            <NFormItem label="产品类型">
                              <NSelect
                                v-model:value="singleForm.productType"
                                :input-props="{
                                  id: 'portal-single-product-type',
                                  name: 'productType',
                                  'aria-label': '产品类型'
                                }"
                                :options="[
                                  { label: '自动匹配', value: '' },
                                  { label: 'FAST', value: 'FAST' },
                                  { label: 'MIXED', value: 'MIXED' }
                                ]"
                              />
                            </NFormItem>
                          </NGi>
                          <NGi span="2">
                            <NFormItem label="扩展参数">
                              <NInput
                                v-model:value="singleForm.extText"
                                type="textarea"
                                :rows="4"
                                placeholder='可选，输入 JSON，例如 {"notify":"manual"}'
                                :input-props="{ id: 'portal-single-ext', name: 'ext', 'aria-label': '扩展参数' }"
                              />
                            </NFormItem>
                          </NGi>
                        </NGrid>
                      </NForm>

                      <div class="flex flex-wrap justify-end gap-12px">
                        <NButton :loading="previewLoading" @click="handlePreviewSingle">智能匹配</NButton>
                        <NButton @click="resetSingleForm">重置</NButton>
                        <NButton type="primary" :loading="singleSubmitting" @click="handleSubmitSingle">
                          提交单笔充值
                        </NButton>
                      </div>
                    </NSpace>
                  </NCard>
                </NGi>

                <NGi>
                  <NCard embedded title="智能匹配结果">
                    <NSpace vertical :size="16">
                      <NAlert :type="singlePreview?.matched ? 'success' : 'warning'" :show-icon="false">
                        {{ previewSummaryText }}
                      </NAlert>

                      <NDescriptions v-if="singlePreview" bordered :column="3" label-placement="left" size="small">
                        <NDescriptionsItem label="手机号">{{ singlePreview.mobile }}</NDescriptionsItem>
                        <NDescriptionsItem label="归属地">
                          {{ renderNullable(singlePreview.province) }}
                        </NDescriptionsItem>
                        <NDescriptionsItem label="运营商">
                          {{ getCarrierLabel(singlePreview.ispName) }}
                        </NDescriptionsItem>
                        <NDescriptionsItem label="是否命中">
                          {{ renderBoolean(singlePreview.matched) }}
                        </NDescriptionsItem>
                        <NDescriptionsItem label="是否拆单">
                          {{ renderBoolean(singlePreview.usedSplit) }}
                        </NDescriptionsItem>
                        <NDescriptionsItem label="供应商">
                          {{ renderNullable(singlePreview.supplierId) }}
                        </NDescriptionsItem>
                      </NDescriptions>

                      <NDataTable
                        :columns="previewColumns"
                        :data="singlePreview?.pieces || []"
                        :pagination="false"
                        :scroll-x="860"
                      />
                    </NSpace>
                  </NCard>
                </NGi>
              </NGrid>
            </template>

            <template v-else-if="tab.name === 'batch'">
              <NSpace vertical :size="16">
                <NCard embedded title="批量充值">
                  <template #header-extra>
                    <div class="flex flex-wrap items-center gap-8px">
                      <NButton :loading="batchTemplateLoading" @click="downloadBatchTemplate">下载 Excel 模板</NButton>
                      <NButton @click="triggerBatchFileDialog">导入 Excel / TXT / CSV</NButton>
                      <NButton @click="parseBatchContent">校验格式</NButton>
                      <NButton type="primary" :loading="batchSubmitting" @click="handleSubmitBatch">
                        开始批量充值
                      </NButton>
                      <NButton secondary :disabled="!batchResults.length" @click="exportBatchResults">导出结果</NButton>
                    </div>
                  </template>

                  <NSpace vertical :size="16">
                    <input
                      ref="batchFileInputRef"
                      type="file"
                      class="hidden"
                      accept=".xlsx,.xls,.csv,.txt"
                      @change="handleBatchFileChange"
                    />

                    <NAlert type="info" :show-icon="false">
                      支持三种输入方式：导入
                      `.xlsx/.xls/.csv/.txt`，直接粘贴多行文本，或按模板填写后导入。允许两种格式：
                      `手机号,充值金额[,产品类型]` 或 `渠道订单号,手机号,充值金额[,产品类型]`。
                    </NAlert>

                    <NInput
                      v-model:value="batchForm.content"
                      type="textarea"
                      :rows="10"
                      placeholder="示例：&#10;13800138000,30,FAST&#10;portal-batch-002,13800138001,100,MIXED"
                    />
                  </NSpace>
                </NCard>

                <NGrid cols="1 xl:2" :x-gap="16" :y-gap="16">
                  <NGi>
                    <NCard embedded title="格式校验结果">
                      <NSpace vertical :size="12">
                        <NAlert v-if="batchErrors.length" type="warning" :show-icon="false">
                          <div class="space-y-4px">
                            <div v-for="errorItem in batchErrors" :key="errorItem">{{ errorItem }}</div>
                          </div>
                        </NAlert>

                        <NDataTable
                          :columns="batchParsedColumns"
                          :data="batchRows"
                          :pagination="false"
                          :scroll-x="900"
                          size="small"
                        />
                      </NSpace>
                    </NCard>
                  </NGi>

                  <NGi>
                    <NCard embedded title="提交结果">
                      <NAlert type="success" :show-icon="false" class="mb-12px">
                        批量充值会逐条调用单笔下单接口，提交后可直接导出结果，并到“消费记录 / 消费日志”继续跟踪状态。
                      </NAlert>

                      <NDataTable
                        :columns="batchResultColumns"
                        :data="batchResults"
                        :pagination="false"
                        :scroll-x="1100"
                        size="small"
                      />
                    </NCard>
                  </NGi>
                </NGrid>
              </NSpace>
            </template>

            <template v-else-if="tab.name === 'products'">
              <NCard embedded title="商品列表">
                <template #header-extra>
                  <div class="flex flex-wrap items-center gap-8px">
                    <NTag :bordered="false" size="small">{{ productSourceLabel }}</NTag>
                    <NButton :loading="productsLoading" @click="loadPortalProducts">查询商品</NButton>
                    <NButton @click="handleResetProductFilter">重置</NButton>
                    <NButton secondary @click="exportPortalProducts">导出当前页</NButton>
                  </div>
                </template>

                <NSpace vertical :size="16">
                  <NForm label-placement="left" label-width="88">
                    <NGrid cols="1 s:2 xl:6" :x-gap="16" :y-gap="8">
                      <NGi>
                        <NFormItem label="关键字">
                          <NInput v-model:value="productFilter.keyword" placeholder="商品名称 / 编码" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="运营商">
                          <NSelect
                            v-model:value="productFilter.carrierCode"
                            clearable
                            :options="[
                              { label: '中国移动', value: 'CMCC' },
                              { label: '中国电信', value: 'CTCC' },
                              { label: '中国联通', value: 'CUCC' },
                              { label: '中国广电', value: 'CBN' }
                            ]"
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
                          <NSelect
                            v-model:value="productFilter.productType"
                            :options="[
                              { label: '全部', value: '' },
                              { label: 'FAST', value: 'FAST' },
                              { label: 'MIXED', value: 'MIXED' }
                            ]"
                          />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="状态">
                          <NInput v-model:value="productFilter.status" placeholder="如：ACTIVE" />
                        </NFormItem>
                      </NGi>
                    </NGrid>
                  </NForm>

                  <NDataTable
                    remote
                    :columns="portalProductColumns"
                    :data="productRows"
                    :loading="productsLoading"
                    :pagination="productPagination"
                    :scroll-x="1780"
                  />
                </NSpace>
              </NCard>
            </template>

            <template v-else-if="tab.name === 'orders'">
              <NCard embedded title="消费记录">
                <template #header-extra>
                  <div class="flex flex-wrap items-center gap-8px">
                    <NButton :loading="ordersLoading" @click="loadOrders">查询记录</NButton>
                    <NButton @click="handleResetOrderFilter">重置</NButton>
                    <NButton secondary @click="exportOrders">导出当前页</NButton>
                  </div>
                </template>

                <NSpace vertical :size="16">
                  <NForm label-placement="left" label-width="88">
                    <NGrid cols="1 s:2 xl:4" :x-gap="16" :y-gap="8">
                      <NGi>
                        <NFormItem label="平台订单号">
                          <NInput v-model:value="orderFilter.orderNo" placeholder="请输入平台订单号" />
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
                          <NInput v-model:value="orderFilter.mainStatus" placeholder="如：SUCCESS" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="供应商状态">
                          <NInput v-model:value="orderFilter.supplierStatus" placeholder="如：PROCESSING" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="退款状态">
                          <NInput v-model:value="orderFilter.refundStatus" placeholder="如：NONE" />
                        </NFormItem>
                      </NGi>
                      <NGi span="2">
                        <NFormItem label="时间范围">
                          <NDatePicker v-model:value="orderDateRange" type="datetimerange" clearable class="w-full" />
                        </NFormItem>
                      </NGi>
                    </NGrid>
                  </NForm>

                  <NDataTable
                    remote
                    :columns="orderColumns"
                    :data="orders"
                    :loading="ordersLoading"
                    :pagination="orderPagination"
                    :scroll-x="1560"
                  />
                </NSpace>
              </NCard>
            </template>

            <template v-else-if="tab.name === 'events'">
              <NCard embedded title="消费日志">
                <template #header-extra>
                  <div class="flex flex-wrap items-center gap-8px">
                    <NButton :loading="eventsLoading" @click="loadOrderEvents">查询日志</NButton>
                    <NButton @click="handleResetEventFilter">重置</NButton>
                    <NButton secondary @click="exportEvents">导出当前结果</NButton>
                  </div>
                </template>

                <NSpace vertical :size="16">
                  <NAlert v-if="selectedOrder" type="info" :show-icon="false">
                    当前查看订单：{{ selectedOrder.orderNo }} / {{ selectedOrder.channelOrderNo }}
                  </NAlert>

                  <NForm label-placement="left" label-width="88">
                    <NGrid cols="1 s:2 xl:4" :x-gap="16" :y-gap="8">
                      <NGi>
                        <NFormItem label="订单号">
                          <NInput v-model:value="eventFilter.orderNo" placeholder="请输入平台订单号" />
                        </NFormItem>
                      </NGi>
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
                          <NDatePicker v-model:value="eventDateRange" type="datetimerange" clearable class="w-full" />
                        </NFormItem>
                      </NGi>
                    </NGrid>
                  </NForm>

                  <NDataTable
                    remote
                    :columns="eventColumns"
                    :data="eventDisplayRows"
                    :loading="eventsLoading"
                    :pagination="eventPagination"
                    :scroll-x="860"
                  />
                </NSpace>
              </NCard>
            </template>

            <template v-else-if="tab.name === 'recharges'">
              <NCard embedded title="充值日志">
                <template #header-extra>
                  <div class="flex flex-wrap items-center gap-8px">
                    <NButton :loading="rechargeLoading" @click="loadPortalRechargeLogs">刷新日志</NButton>
                    <NButton @click="handleResetRechargeLogFilter">重置</NButton>
                    <NButton secondary @click="exportPortalRechargeLogs">导出当前结果</NButton>
                  </div>
                </template>

                <NSpace vertical :size="16">
                  <NAlert v-if="rechargeHint" type="info" :show-icon="false">
                    {{ rechargeHint }}
                  </NAlert>

                  <NForm label-placement="left" label-width="88">
                    <NGrid cols="1 s:2 xl:4" :x-gap="16" :y-gap="8">
                      <NGi>
                        <NFormItem label="平台订单号">
                          <NInput v-model:value="rechargeFilter.orderNo" placeholder="请输入平台订单号" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="渠道订单号">
                          <NInput v-model:value="rechargeFilter.channelOrderNo" placeholder="请输入渠道订单号" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="手机号">
                          <NInput v-model:value="rechargeFilter.mobile" placeholder="请输入手机号" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="主状态">
                          <NInput v-model:value="rechargeFilter.mainStatus" placeholder="如 SUCCESS" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="供应商状态">
                          <NInput v-model:value="rechargeFilter.supplierStatus" placeholder="如 PROCESSING" />
                        </NFormItem>
                      </NGi>
                      <NGi>
                        <NFormItem label="退款状态">
                          <NInput v-model:value="rechargeFilter.refundStatus" placeholder="如 NONE" />
                        </NFormItem>
                      </NGi>
                      <NGi span="2">
                        <NFormItem label="时间范围">
                          <NDatePicker
                            v-model:value="rechargeDateRange"
                            type="datetimerange"
                            clearable
                            class="w-full"
                          />
                        </NFormItem>
                      </NGi>
                    </NGrid>
                  </NForm>

                  <NDataTable
                    :columns="portalRechargeColumns"
                    :data="rechargeRecords"
                    :loading="rechargeLoading"
                    :pagination="false"
                    :scroll-x="1860"
                  />
                </NSpace>
              </NCard>
            </template>
          </NTabPane>
        </NTabs>
      </NCard>
    </div>

    <NModal v-model:show="jsonModalVisible" preset="card" :title="jsonModalTitle" style="width: min(920px, 92vw)">
      <NCode :code="stringifyJson(jsonModalData)" language="json" show-line-numbers />
    </NModal>
  </NSpin>
</template>

<style scoped>
.portal-header-card {
  display: grid;
  gap: 18px;
  border-radius: 24px;
  box-shadow: 0 18px 48px rgb(15 23 42 / 0.06);
  background:
    radial-gradient(circle at top right, rgb(59 130 246 / 0.12), transparent 28%),
    linear-gradient(180deg, #fff 0%, #f8fafc 100%);
}

.portal-header-card__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #2563eb;
  text-transform: uppercase;
}

.portal-header-card__title {
  margin-top: 8px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
  color: #0f172a;
}

.portal-header-card__desc {
  margin-top: 10px;
  max-width: 820px;
  font-size: 14px;
  line-height: 1.7;
  color: #64748b;
}

.portal-header-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  color: #475569;
  font-size: 13px;
}

.portal-header-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.summary-card {
  min-height: 320px;
  box-shadow: 0 14px 36px rgb(15 23 42 / 0.04);
}

.portal-side-card,
.content-card {
  box-shadow: 0 18px 48px rgb(15 23 42 / 0.06);
}

.portal-side-card {
  border-radius: 24px;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
}

.portal-side-card__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #0f766e;
  text-transform: uppercase;
}

.portal-side-card__title {
  margin-top: 10px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
  color: #0f172a;
}

.portal-side-card__desc {
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.7;
  color: #64748b;
}

.portal-side-card__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 18px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #fff;
  color: #475569;
  font-size: 13px;
}

.portal-side-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.portal-side-nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.portal-side-nav__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 15px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
  box-shadow: 0 12px 24px rgb(15 23 42 / 0.04);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.portal-side-nav__item:hover {
  border-color: #bfdbfe;
  box-shadow: 0 18px 32px rgb(37 99 235 / 0.08);
  transform: translateX(2px);
}

.portal-side-nav__item--active {
  border-color: #93c5fd;
  background: linear-gradient(180deg, #eff6ff 0%, #fff 100%);
  box-shadow: 0 22px 40px rgb(37 99 235 / 0.12);
}

.portal-side-nav__content {
  min-width: 0;
}

.portal-side-nav__title {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #0f172a;
}

.portal-side-nav__desc {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.portal-side-nav__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.portal-side-nav__item--active .portal-side-nav__badge {
  background: #dbeafe;
  color: #1d4ed8;
}

.content-card {
  overflow: hidden;
}

.content-card__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e2e8f0;
}

.content-card__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #2563eb;
  text-transform: uppercase;
}

.content-card__title {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: #0f172a;
}

.content-card__desc {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.6;
  color: #64748b;
}

.content-card__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  color: #64748b;
  font-size: 13px;
}

.content-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  padding: 8px 14px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: linear-gradient(180deg, #eff6ff 0%, #fff 100%);
  color: #1d4ed8;
  font-weight: 700;
}

.content-card__summary {
  max-width: 240px;
  line-height: 1.5;
  text-align: right;
}

.portal-tabs {
  min-height: 720px;
}

.portal-tabs :deep(.n-tabs-nav) {
  display: none;
}

.portal-tabs :deep(.n-tabs-pane-wrapper) {
  padding-top: 4px;
}

@media (width <= 1279px) {
  .portal-header-card__title {
    font-size: 26px;
  }

  .content-card__hero {
    flex-direction: column;
  }

  .content-card__meta {
    align-items: flex-start;
  }

  .content-card__summary {
    max-width: none;
    text-align: left;
  }

  .portal-tabs {
    min-height: auto;
  }

  .portal-side-card__title {
    font-size: 26px;
  }
}
</style>
