import { portalRequest } from '../request/portal';

export function fetchPortalLogin(username: string, password: string) {
  return portalRequest<Api.Portal.LoginToken>({
    url: '/portal/auth/login',
    method: 'post',
    data: {
      username,
      password
    }
  });
}

export function fetchPortalLogout() {
  return portalRequest<Api.Common.OperationResult>({
    url: '/portal/auth/logout',
    method: 'post'
  });
}

export function fetchGetPortalMe() {
  return portalRequest<Api.Portal.Me>({
    url: '/portal/me'
  });
}

export function fetchGetPortalChannelProfile() {
  return portalRequest<Api.Portal.ChannelProfile>({
    url: '/open-api/channel/profile'
  });
}

export function fetchGetPortalChannelQuota() {
  return portalRequest<Api.Portal.ChannelQuota>({
    url: '/open-api/channel/quota'
  });
}

export function fetchGetPortalProducts(params?: Api.Portal.ProductQueryParams) {
  return portalRequest<Api.Portal.ProductItem[]>({
    url: '/open-api/products/',
    params
  });
}

export function fetchGetPortalOrders(params: Api.Portal.OrderQueryParams) {
  return portalRequest<Api.Common.PagedData<Api.Portal.OrderItem>>({
    url: '/open-api/orders/',
    params
  });
}

export function fetchCreatePortalOrder(data: Api.Portal.CreateOrderForm) {
  return portalRequest<Api.Portal.OrderMutationResult>({
    url: '/open-api/orders/',
    method: 'post',
    data
  });
}

export function fetchCreatePortalBatchOrders(data: Api.Portal.BatchCreateOrderForm) {
  return portalRequest<Api.Portal.OrderMutationResult>({
    url: '/open-api/orders/batch',
    method: 'post',
    data
  });
}

export function fetchGetPortalOrderEvents(orderNo: string, params?: Api.Portal.OrderEventQueryParams) {
  return portalRequest<Api.Common.PagedData<Api.Portal.OrderEvent> | Api.Portal.OrderEvent[]>({
    url: `/open-api/orders/${orderNo}/events`,
    params
  });
}

export function fetchGetPortalChannelBalance(channelId: string) {
  return portalRequest<Api.Channel.Balance>({
    url: `/admin/channels/${channelId}/balance`
  });
}

export function fetchGetPortalRechargeRecords(channelId: string) {
  return portalRequest<Api.Channel.RechargeRecord[]>({
    url: `/admin/channels/${channelId}/recharge-records`
  });
}
