import type { RouteMeta } from 'vue-router';
import ElegantVueRouter from '@elegant-router/vue/vite';
import type { RouteKey } from '@elegant-router/types';

export function setupElegantRouter() {
  return ElegantVueRouter({
    layouts: {
      base: 'src/layouts/base-layout/index.vue',
      blank: 'src/layouts/blank-layout/index.vue'
    },
    routePathTransformer(routeName, routePath) {
      const key = routeName as RouteKey;

      if (key === 'login') {
        const modules: UnionKey.LoginModule[] = ['pwd-login', 'code-login', 'register', 'reset-pwd', 'bind-wechat'];

        const moduleReg = modules.join('|');

        return `/login/:module(${moduleReg})?`;
      }

      return routePath;
    },
    onRouteMetaGen(routeName) {
      const key = routeName as RouteKey;

      const constantRoutes: RouteKey[] = ['login', '403', '404', '500'];
      const routeMetaMap: Partial<Record<RouteKey, Partial<RouteMeta>>> = {
        channels: {
          title: '渠道管理',
          icon: 'mdi:account-network-outline',
          order: 2
        },
        suppliers: {
          title: '供应商管理',
          icon: 'mdi:truck-delivery-outline',
          order: 3
        },
        portal: {
          title: '渠道门户',
          icon: 'mdi:storefront-outline',
          order: 1,
          constant: true
        },
        portal_overview: {
          title: '概览',
          order: 1,
          constant: true
        },
        portal_single: {
          title: '单笔充值',
          order: 2,
          constant: true
        },
        portal_batch: {
          title: '批量充值',
          order: 3,
          constant: true
        },
        portal_products: {
          title: '商品列表',
          order: 4,
          constant: true
        },
        portal_orders: {
          title: '消费记录',
          order: 5,
          constant: true
        },
        portal_events: {
          title: '消费日志',
          order: 6,
          constant: true
        },
        portal_recharges: {
          title: '充值日志',
          order: 7,
          constant: true
        }
      };

      const meta: Partial<RouteMeta> = {
        title: key,
        i18nKey: `route.${key}` as App.I18n.I18nKey,
        ...routeMetaMap[key]
      };

      if (constantRoutes.includes(key)) {
        meta.constant = true;
      }

      return meta;
    }
  });
}
