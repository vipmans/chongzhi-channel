import { request } from '../request';

export function fetchGetChannels(params: Api.Channel.QueryParams) {
  return request<Api.Common.PagedData<Api.Channel.Item>>({
    url: '/admin/channels',
    params
  });
}

export function fetchCreateChannel(data: Api.Channel.EntityForm) {
  return request<Api.Common.OperationResult>({
    url: '/admin/channels',
    method: 'post',
    data
  });
}

export function fetchGetChannelDetail(channelId: string) {
  return request<Api.Channel.Detail>({
    url: `/admin/channels/${channelId}`
  });
}

export function fetchUpdateChannel(channelId: string, data: Api.Channel.EntityForm) {
  return request<Api.Common.OperationResult>({
    url: `/admin/channels/${channelId}`,
    method: 'put',
    data
  });
}

export function fetchGetChannelProducts(channelId: string, params?: Api.Channel.ProductQueryParams) {
  return request<Api.Channel.ProductItem[]>({
    url: `/admin/channels/${channelId}/products`,
    params
  });
}

export function fetchGetChannelBalance(channelId: string) {
  return request<Api.Channel.Balance>({
    url: `/admin/channels/${channelId}/balance`
  });
}

export function fetchGetChannelRechargeRecords(channelId: string) {
  return request<Api.Channel.RechargeRecord[]>({
    url: `/admin/channels/${channelId}/recharge-records`
  });
}

export function fetchRechargeChannel(channelId: string, data: Api.Channel.RechargeForm) {
  return request<Api.Common.OperationResult>({
    url: `/admin/channels/${channelId}/recharge`,
    method: 'post',
    data
  });
}
