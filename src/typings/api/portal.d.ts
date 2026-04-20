declare namespace Api {
  namespace Portal {
    type CarrierCode = 'CMCC' | 'CTCC' | 'CUCC' | 'CBN';
    type ProductType = 'FAST' | 'MIXED';
    type SortOrder = 'asc' | 'desc';
    type PagedOrList<T> = Api.Common.PagedData<T> | T[];

    interface Me {
      channelId: string;
      channelCode: string;
      channelName: string;
      status: string;
      roleCodes: string[];
      permissions: string[];
    }

    interface LoginToken {
      accessToken: string;
      expiresInSeconds: number;
      me: Me;
    }

    type ChannelProfile = Api.Channel.Detail;

    interface ChannelQuotaRule {
      singleLimitAmountFen: number;
      dailyLimitAmountFen: number;
      monthlyLimitAmountFen: number;
      qpsLimit: number;
    }

    interface ChannelQuota {
      channelId: string;
      limitRule: ChannelQuotaRule | null;
    }

    interface ProductQueryParams {
      carrierCode?: CarrierCode;
      province?: string;
      faceValue?: number | null;
      productType?: ProductType | '';
      status?: string;
    }

    interface ProductItem {
      productId: string;
      productName: string;
      faceValueFen: number;
      salePriceFen: number | null;
      rechargeRange: number[];
      arrivalSla: string;
      carrierCode: CarrierCode;
      operator: string;
      routeStatus: string;
      splitSupport: boolean;
    }

    interface CreateOrderForm {
      channelOrderNo: string;
      mobile: string;
      faceValue: number;
      product_type?: ProductType;
      ext?: Record<string, unknown>;
    }

    interface BatchOrderItem {
      channelOrderNo: string;
      mobile: string;
      faceValue: number;
      productType?: ProductType;
      ext?: Record<string, unknown>;
    }

    interface BatchCreateOrderForm {
      orders: BatchOrderItem[];
    }

    type OrderMutationResult = Record<string, unknown>;

    interface OrderQueryParams {
      pageNum: number;
      pageSize: number;
      orderNo?: string;
      channelOrderNo?: string;
      mobile?: string;
      mainStatus?: string;
      supplierStatus?: string;
      refundStatus?: string;
      startTime?: string;
      endTime?: string;
    }

    interface OrderItem {
      orderNo: string;
      channelOrderNo: string;
      channelId: string;
      productId: string | null;
      mobile: string;
      province: string | null;
      ispName: string | null;
      requestedProductType: string;
      faceValueAmountFen: number;
      saleAmountFen: number;
      purchaseAmountFen: number;
      currency: string;
      mainStatus: string;
      supplierStatus: string;
      notifyStatus: string;
      refundStatus: string;
      monitorStatus: string;
      exceptionTag: string | null;
      createdAt: string;
      updatedAt: string;
      finishedAt: string | null;
    }

    interface OrderEventQueryParams {
      pageNum?: number;
      pageSize?: number;
      startTime?: string;
      endTime?: string;
      sortBy?: string;
      sortOrder?: SortOrder;
    }

    interface OrderEvent {
      id: string;
      orderNo: string;
      eventType: string;
      sourceService: string;
      sourceNo: string | null;
      beforeStatus: Record<string, unknown>;
      afterStatus: Record<string, unknown>;
      payload: Record<string, unknown>;
      operator: string;
      occurredAt: string;
    }
  }
}
