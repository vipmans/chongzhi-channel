import { request } from '../request';

export function fetchGetSuppliers(params: Api.Supplier.QueryParams) {
  return request<Api.Common.PagedData<Api.Supplier.Item>>({
    url: '/admin/suppliers',
    params
  });
}

export function fetchCreateSupplier(data: Api.Supplier.EntityForm) {
  return request<Api.Common.OperationResult>({
    url: '/admin/suppliers',
    method: 'post',
    data
  });
}

export function fetchGetSupplierDetail(supplierId: string) {
  return request<Api.Supplier.Detail>({
    url: `/admin/suppliers/${supplierId}`
  });
}

export function fetchUpdateSupplier(supplierId: string, data: Api.Supplier.EntityForm) {
  return request<Api.Common.OperationResult>({
    url: `/admin/suppliers/${supplierId}`,
    method: 'put',
    data
  });
}

export function fetchGetSupplierHealth(supplierId: string) {
  return request<Api.Supplier.Health>({
    url: `/admin/suppliers/${supplierId}/health`
  });
}

export function fetchGetSupplierBalance(supplierId: string) {
  return request<Api.Supplier.Balance>({
    url: `/admin/suppliers/${supplierId}/balance`
  });
}

export function fetchRefreshSupplierBalance(supplierId: string) {
  return request<Api.Supplier.Balance>({
    url: `/admin/suppliers/${supplierId}/balance/refresh`,
    method: 'post'
  });
}

export function fetchGetSupplierConsumptionLogs(supplierId: string, params?: Api.Supplier.ConsumptionLogQueryParams) {
  return request<Api.Supplier.ConsumptionLog[]>({
    url: `/admin/suppliers/${supplierId}/consumption-logs`,
    params
  });
}

export function fetchGetSupplierProducts(supplierId: string, params?: Api.Supplier.ProductQueryParams) {
  return request<Api.Supplier.ProductItem[]>({
    url: `/admin/suppliers/${supplierId}/products`,
    params
  });
}

export function fetchGetSupplierRechargeRecords(supplierId: string) {
  return request<Api.Supplier.RechargeRecord[]>({
    url: `/admin/suppliers/${supplierId}/recharge-records`
  });
}

export function fetchCreateSupplierRechargeRecord(supplierId: string, data: Api.Supplier.RechargeRecordForm) {
  return request<Api.Supplier.RechargeRecord>({
    url: `/admin/suppliers/${supplierId}/recharge-records`,
    method: 'post',
    data
  });
}
