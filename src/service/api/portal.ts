import { request } from '../request';
import { portalSmartRequest, portalSmartSilentRequest } from '../request/portal';

export function fetchPortalLogin(username: string, password: string) {
  return portalSmartRequest<Api.Portal.LoginToken>({
    url: '/portal/auth/login',
    method: 'post',
    data: {
      username,
      password
    }
  });
}

export function fetchPortalLogout() {
  return portalSmartRequest<Api.Common.OperationResult>({
    url: '/portal/auth/logout',
    method: 'post'
  });
}

export function fetchGetPortalMe() {
  return portalSmartRequest<Api.Portal.Me>({
    url: '/portal/me'
  });
}

export function fetchGetPortalChannelProfile() {
  return portalSmartRequest<Api.Portal.ChannelProfile>({
    url: '/open-api/channel/profile'
  });
}

export function fetchGetPortalChannelQuota() {
  return portalSmartRequest<Api.Portal.ChannelQuota>({
    url: '/open-api/channel/quota'
  });
}

export function fetchGetAdminProducts(params: Api.Portal.AdminProductQueryParams) {
  return request<Api.Common.PagedData<Api.Portal.AdminProductItem>>({
    url: '/admin/products',
    params
  });
}

export function fetchGetPortalProducts(params?: Api.Portal.ProductQueryParams) {
  return portalSmartRequest<Api.Portal.OpenProductItem[]>({
    url: '/open-api/products/',
    params
  });
}

export function fetchPreviewPortalOrderSplit(data: Api.Portal.OrderPreviewForm) {
  return portalSmartSilentRequest<Api.Portal.OrderPreviewResult>({
    url: '/open-api/orders/preview-split',
    method: 'post',
    data
  });
}

export function fetchGetPortalCustomerDetail(mobile: string) {
  return portalSmartSilentRequest<Api.Portal.CustomerDetailResult>({
    url: `/open-api/orders/customers/${mobile}`
  });
}

export function fetchGetPortalOrders(params: Api.Portal.OrderQueryParams) {
  return portalSmartRequest<Api.Common.PagedData<Api.Portal.OrderItem>>({
    url: '/open-api/orders/',
    params
  });
}

export function fetchCreatePortalOrder(data: Api.Portal.CreateOrderForm) {
  return portalSmartRequest<Api.Portal.OrderItem>({
    url: '/open-api/orders/',
    method: 'post',
    data
  });
}

export function fetchGetPortalBatchTemplate() {
  return portalSmartRequest<Api.Portal.BatchTemplate>({
    url: '/open-api/orders/batch-template'
  });
}

export function fetchGetPortalOrderEvents(orderNo: string, params?: Api.Portal.OrderEventQueryParams) {
  return portalSmartRequest<Api.Common.PagedData<Api.Portal.OrderEvent> | Api.Portal.OrderEvent[]>({
    url: `/open-api/orders/${orderNo}/events`,
    params
  });
}

export function fetchGetPortalChannelBalance(channelId: string) {
  return request<Api.Channel.Balance>({
    url: `/admin/channels/${channelId}/balance`
  });
}

export function fetchGetPortalRechargeRecords(channelId: string) {
  return request<Api.Channel.RechargeRecord[]>({
    url: `/admin/channels/${channelId}/recharge-records`
  });
}
