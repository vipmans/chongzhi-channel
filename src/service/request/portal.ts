import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { BACKEND_ERROR_CODE, createFlatRequest, type CustomAxiosRequestConfig } from '@sa/axios';
import { localStg } from '@/utils/storage';
import { getServiceBaseURL } from '@/utils/service';
import { showErrorMsg } from './shared';
import type { RequestInstanceState } from './type';

const PORTAL_TOKEN_KEY = 'portalToken';

const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
const directBaseURL = import.meta.env.VITE_SERVICE_BASE_URL;
const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);

const portalRequestConfig = {
  baseURL,
  headers: {
    apifoxToken: 'XL299LiMEDZ0H5h3A29PxwQXdMJqWyY2'
  }
};

const directPortalRequestConfig = {
  baseURL: directBaseURL,
  headers: {
    apifoxToken: 'XL299LiMEDZ0H5h3A29PxwQXdMJqWyY2'
  }
};

function createPortalRequestOptions() {
  return {
    defaultState: {
      errMsgStack: [],
      refreshTokenPromise: null
    } as RequestInstanceState,
    transform(response: AxiosResponse<App.Service.Response<any>>) {
      return response.data.data;
    },
    async onRequest(config: InternalAxiosRequestConfig) {
      const Authorization = getPortalAuthorization();

      if (Authorization) {
        Object.assign(config.headers, { Authorization });
      }

      return config;
    },
    isBackendSuccess(response: AxiosResponse<App.Service.Response<any>>) {
      return String(response.data.code) === import.meta.env.VITE_SERVICE_SUCCESS_CODE;
    },
    async onBackendFail() {
      return null;
    }
  };
}

export function getPortalToken() {
  return localStg.get(PORTAL_TOKEN_KEY) || '';
}

export function setPortalToken(token: string) {
  localStg.set(PORTAL_TOKEN_KEY, token);
}

export function clearPortalAuthStorage() {
  localStg.remove(PORTAL_TOKEN_KEY);
}

function getPortalAuthorization() {
  const token = getPortalToken();

  return token ? `Bearer ${token}` : null;
}

export const portalRequest = createFlatRequest(portalRequestConfig, {
  ...createPortalRequestOptions(),
  onError(error) {
    let message = error.message;

    if (error.code === BACKEND_ERROR_CODE) {
      message = error.response?.data?.message || error.response?.data?.msg || message;
    }

    showErrorMsg(portalRequest.state, message);
  }
});

export const portalSilentRequest = createFlatRequest(portalRequestConfig, {
  ...createPortalRequestOptions(),
  onError() {}
});

const directPortalRequest = createFlatRequest(directPortalRequestConfig, {
  ...createPortalRequestOptions(),
  onError(error) {
    let message = error.message;

    if (error.code === BACKEND_ERROR_CODE) {
      message = error.response?.data?.message || error.response?.data?.msg || message;
    }

    showErrorMsg(directPortalRequest.state, message);
  }
});

const directPortalSilentRequest = createFlatRequest(directPortalRequestConfig, {
  ...createPortalRequestOptions(),
  onError() {}
});

function shouldRetryWithDirect(error: unknown) {
  if (!isHttpProxy || baseURL === directBaseURL || !error || typeof error !== 'object') {
    return false;
  }

  const response = (error as { response?: { status?: number } }).response;

  return response?.status === 404;
}

export async function portalSmartRequest<T>(config: CustomAxiosRequestConfig) {
  const response = await portalRequest<T>(config);

  if (!shouldRetryWithDirect(response.error)) {
    return response;
  }

  return directPortalRequest<T>(config);
}

export async function portalSmartSilentRequest<T>(config: CustomAxiosRequestConfig) {
  const response = await portalSilentRequest<T>(config);

  if (!shouldRetryWithDirect(response.error)) {
    return response;
  }

  return directPortalSilentRequest<T>(config);
}
