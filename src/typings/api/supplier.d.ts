declare namespace Api {
  namespace Supplier {
    type SortOrder = 'asc' | 'desc';

    interface QueryParams {
      pageNum: number;
      pageSize: number;
      keyword?: string;
      cooperationStatus?: string;
      healthStatus?: string;
      protocolType?: string;
      sortBy?: string;
      sortOrder?: SortOrder;
    }

    interface ProductQueryParams {
      carrierCode?: string;
      province?: string;
      faceValue?: number | null;
      status?: string;
      updatedStartTime?: string;
      updatedEndTime?: string;
    }

    interface ConsumptionLogQueryParams {
      startTime?: string;
      endTime?: string;
      mobile?: string;
      orderNo?: string;
      supplierOrderNo?: string;
    }

    interface EntityForm {
      supplierCode?: string;
      supplierName: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
      baseUrl?: string;
      protocolType: string;
      credentialMode?: string;
      accessAccount?: string;
      accessPassword?: string;
      cooperationStatus?: string;
      supportsBalanceQuery?: boolean;
      supportsRechargeRecords?: boolean;
      supportsConsumptionLog?: boolean;
      remark?: string;
      healthStatus?: string;
      status?: string;
    }

    interface RechargeRecordForm {
      rechargeType: string;
      amountFen: number;
      currency?: string;
      beforeBalanceFen?: number;
      afterBalanceFen?: number;
      recordSource: string;
      supplierTradeNo?: string;
      remark?: string;
      rawPayload?: Record<string, unknown>;
      status?: string;
    }

    interface Item {
      supplierId: string;
      supplierCode: string;
      supplierName: string;
      contactName: string | null;
      contactPhone: string | null;
      contactEmail: string | null;
      baseUrl: string | null;
      protocolType: string;
      credentialMode: string;
      accessAccount: string | null;
      accessPassword: string | null;
      cooperationStatus: string;
      supportsBalanceQuery: boolean;
      supportsRechargeRecords: boolean;
      supportsConsumptionLog: boolean;
      remark: string | null;
      healthStatus: string;
      lastHealthCheckAt: string | null;
      createdAt: string;
      updatedAt: string;
      status?: string;
    }

    type Detail = Item;

    interface Health {
      supplierId: string;
      healthStatus: string;
      httpStatus: number | null;
      message: string | null;
      lastSuccessAt: string | null;
      lastFailureAt: string | null;
      checkedAt: string | null;
    }

    interface Balance {
      supplierId: string;
      balanceAmountFen: number;
      currency: string;
      balanceStatus: string;
      sourceType: string;
      queriedAt: string;
      rawPayload: Record<string, unknown>;
    }

    interface ConsumptionLog {
      id: string;
      supplierId: string;
      mobile: string;
      orderNo: string | null;
      supplierOrderNo: string | null;
      amountFen: number;
      status: string;
      occurredAt: string;
      rawPayload: Record<string, unknown>;
    }

    interface ProductItem {
      snapshotId: string;
      supplierId: string;
      supplierCode: string;
      supplierProductCode: string;
      productName: string;
      carrierCode: string;
      province: string;
      faceValueFen: number;
      costPriceFen: number;
      saleStatus: string;
      stockStatus: string;
      arrivalSla: string;
      rechargeRange: unknown;
      updatedAt: string;
      rawPayload: Record<string, unknown>;
    }

    interface RechargeRecord {
      recordId: string;
      supplierId: string;
      rechargeType: string;
      amountFen: number;
      currency: string;
      beforeBalanceFen: number;
      afterBalanceFen: number;
      recordSource: string;
      supplierTradeNo: string | null;
      remark: string | null;
      rawPayload: Record<string, unknown>;
      status: string;
      operatorUserId: string | null;
      operatorUsername: string | null;
      createdAt: string;
    }
  }
}
