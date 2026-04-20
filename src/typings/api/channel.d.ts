declare namespace Api {
  namespace Channel {
    type SortOrder = 'asc' | 'desc';

    interface QueryParams {
      pageNum: number;
      pageSize: number;
      keyword?: string;
      status?: string;
      cooperationStatus?: string;
      protocolType?: string;
      channelType?: string;
      sortBy?: string;
      sortOrder?: SortOrder;
    }

    interface ProductQueryParams {
      carrierCode?: string;
      province?: string;
      faceValue?: number | null;
      status?: string;
    }

    interface EntityForm {
      channelCode: string;
      channelName: string;
      channelType: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
      baseUrl?: string;
      protocolType?: string;
      accessAccount?: string;
      accessPassword?: string;
      cooperationStatus?: string;
      supportsConsumptionLog?: boolean;
      settlementMode?: string;
      status?: string;
      remark?: string;
    }

    interface RechargeForm {
      amount: number;
      remark: string;
    }

    interface Item extends Required<
      Omit<EntityForm, 'protocolType' | 'cooperationStatus' | 'settlementMode' | 'status'>
    > {
      id: string;
      protocolType: string;
      cooperationStatus: string;
      settlementMode: string;
      status: string;
      remark: string | null;
      contactName: string | null;
      contactPhone: string | null;
      contactEmail: string | null;
      baseUrl: string | null;
      accessAccount: string | null;
      accessPassword: string | null;
      createdAt: string;
      updatedAt: string;
    }

    type Detail = Item;

    interface ProductItem {
      channelId: string;
      productId: string;
      productName: string;
      carrierCode: string;
      province: string;
      faceValueFen: number;
      salePriceFen: number | null;
      authorized: boolean;
      routeSupplierId: string | null;
      routeSupplierName: string | null;
      latestSnapshotAt: string | null;
      status: string;
    }

    interface Balance {
      channelId: string;
      availableBalanceFen: number;
      frozenBalanceFen: number;
      currency: string;
      status: string;
      updatedAt: string | null;
    }

    interface RechargeRecord {
      recordId: string;
      channelId: string;
      amountFen: number;
      beforeBalanceFen: number;
      afterBalanceFen: number;
      currency: string;
      recordSource: string;
      remark: string | null;
      operatorUserId: string | null;
      operatorUsername: string | null;
      createdAt: string;
    }
  }
}
