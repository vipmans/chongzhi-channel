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

    interface AdminProductQueryParams {
      pageNum: number;
      pageSize: number;
      keyword?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: SortOrder;
      carrierCode?: CarrierCode;
      productType?: ProductType | '';
    }

    interface AdminProductItem {
      id: string;
      productCode: string;
      productName: string;
      carrierCode: CarrierCode;
      provinceName: string;
      faceValueAmountFen: number;
      productType: ProductType;
      salesUnit: string;
      status: string;
    }

    interface ProductQueryParams {
      carrierCode?: CarrierCode;
      province?: string;
      faceValue?: number | null;
      productType?: ProductType | '';
      status?: string;
    }

    interface OpenProductItem {
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

    interface OrderPreviewForm {
      mobile: string;
      faceValue: number;
      productType?: ProductType;
    }

    interface OrderPreviewPiece {
      productId: string;
      productName: string;
      supplierId: string;
      supplierName: string;
      faceValueAmountFen: number;
      saleAmountFen: number;
      purchaseAmountFen: number;
    }

    interface OrderPreviewResult {
      matched: boolean;
      unmatchedReason: string | null;
      usedSplit: boolean;
      supplierId: string | null;
      mobile: string;
      province: string | null;
      ispName: string | null;
      pieces: OrderPreviewPiece[];
    }

    interface CustomerLookupItem {
      mobile: string;
      province: string | null;
      ispName: string | null;
    }

    interface CustomerDetail {
      basicInfo?: CustomerLookupItem | null;
      mobile?: string;
      province?: string | null;
      ispName?: string | null;
    }

    type CustomerDetailResult = Api.Common.PagedData<CustomerLookupItem> | CustomerDetail;

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
      mobile: string;
      province: string | null;
      ispName: string | null;
      faceValue: number;
      matchedProductId: string | null;
      salePrice: number;
      currency: string;
      mainStatus: string;
      supplierStatus: string;
      notifyStatus: string;
      refundStatus: string;
      requestedProductType: ProductType | string;
      extJson: Record<string, unknown>;
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
      eventType: string;
      sourceNo: string | null;
      beforeStatusJson: Record<string, unknown>;
      afterStatusJson: Record<string, unknown>;
      occurredAt: string;
    }

    interface BatchTemplate {
      fileName: string;
      content: string;
    }
  }
}
