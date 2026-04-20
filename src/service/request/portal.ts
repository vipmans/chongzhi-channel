import type { AxiosResponse } from 'axios';
import { BACKEND_ERROR_CODE, createFlatRequest } from '@sa/axios';
import { localStg } from '@/utils/storage';
import { getServiceBaseURL } from '@/utils/service';
import { showErrorMsg } from './shared';
import type { RequestInstanceState } from './type';

const PORTAL_TOKEN_KEY = 'portalToken';

const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);

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

export const portalRequest = createFlatRequest(
  {
    baseURL,
    headers: {
      apifoxToken: 'XL299LiMEDZ0H5h3A29PxwQXdMJqWyY2'
    }
  },
  {
    defaultState: {
      errMsgStack: [],
      refreshTokenPromise: null
    } as RequestInstanceState,
    transform(response: AxiosResponse<App.Service.Response<any>>) {
      return response.data.data;
    },
    async onRequest(config) {
      const Authorization = getPortalAuthorization();

      if (Authorization) {
        Object.assign(config.headers, { Authorization });
      }

      return config;
    },
    isBackendSuccess(response) {
      return String(response.data.code) === import.meta.env.VITE_SERVICE_SUCCESS_CODE;
    },
    async onBackendFail() {
      return null;
    },
    onError(error) {
      let message = error.message;

      if (error.code === BACKEND_ERROR_CODE) {
        message = error.response?.data?.message || error.response?.data?.msg || message;
      }

      showErrorMsg(portalRequest.state, message);
    }
  }
);
