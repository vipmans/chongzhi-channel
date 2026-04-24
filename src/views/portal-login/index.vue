<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchPortalLogin } from '@/service/api';
import { setPortalToken } from '@/service/request/portal';

defineOptions({
  name: 'PortalLoginPage'
});

const router = useRouter();
const route = useRoute();

const loginLoading = ref(false);

const loginModel = reactive({
  username: '',
  password: ''
});

async function handleLogin() {
  const username = loginModel.username.trim();
  const password = loginModel.password.trim();

  if (!username || !password) {
    window.$message?.warning('请输入渠道门户账号和密码');
    return;
  }

  loginLoading.value = true;

  const { data, error } = await fetchPortalLogin(username, password);

  loginLoading.value = false;

  if (error) {
    return;
  }

  setPortalToken(data.accessToken);
  window.$message?.success('渠道门户登录成功');

  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/portal/overview';
  await router.replace(redirect);
}

function fillDemoAccount() {
  loginModel.username = 'demo.portal';
  loginModel.password = 'Portal123!';
}
</script>

<template>
  <div class="portal-login min-h-screen">
    <div class="mx-auto max-w-1280px px-16px py-32px lg:px-24px lg:py-40px">
      <div class="grid gap-20px xl:grid-cols-[1.05fr,420px]">
        <NCard :bordered="false" class="hero-card">
          <div class="space-y-22px">
            <div class="space-y-12px">
              <div class="text-12px font-700 tracking-[0.24em] text-[#0f766e] uppercase">Channel Portal</div>
              <div class="text-34px font-700 leading-[1.2] text-[#0f172a]">金骏渠道管理系统</div>
              <div class="max-w-720px text-15px leading-7 text-[#475569]">
                外部代理销售渠道统一通过渠道门户登录。渠道账号需先在管理系统中完成审核开通，登录后仅展示当前渠道自身业务相关的产品、订单、充值和日志能力。
              </div>
            </div>

            <NAlert type="info" :show-icon="false">
              登录接口：
              <code>POST /portal/auth/login</code>
            </NAlert>

            <div class="grid gap-16px md:grid-cols-3">
              <div class="feature-card">
                <div class="feature-card__title">账号来源</div>
                <div class="feature-card__desc">
                  由管理平台审核开通后分配独立门户账号，不依赖当前浏览器的后台管理员登录态。
                </div>
              </div>
              <div class="feature-card">
                <div class="feature-card__title">登录方式</div>
                <div class="feature-card__desc">
                  统一使用渠道门户账号密码登录，前端不再直接读取
                  <code>/admin/channels</code>
                  中的敏感信息。
                </div>
              </div>
              <div class="feature-card">
                <div class="feature-card__title">可见范围</div>
                <div class="feature-card__desc">登录后仅查看和当前渠道业务相关的数据，角色与权限信息也会分开展示。</div>
              </div>
            </div>

            <div
              class="rounded-20px bg-white/72 px-18px py-16px text-14px leading-7 text-[#334155] ring-1 ring-white/70"
            >
              <div class="font-600 text-[#0f172a]">联调测试账号</div>
              <div>
                渠道编码：
                <code>demo-channel</code>
              </div>
              <div>
                用户名：
                <code>demo.portal</code>
              </div>
              <div>
                密码：
                <code>Portal123!</code>
              </div>
              <div class="mt-10px">
                <NButton tertiary type="primary" @click="fillDemoAccount">一键填入测试账号</NButton>
              </div>
            </div>
          </div>
        </NCard>

        <NCard :bordered="false" class="login-card">
          <div class="space-y-18px">
            <div>
              <div class="text-26px font-700 text-[#0f172a]">渠道门户登录</div>
              <div class="mt-8px text-14px leading-6 text-[#64748b]">
                使用渠道门户账号密码登录。若未开通账号，请先在管理系统平台完成审核。
              </div>
            </div>

            <NForm label-placement="top" @keyup.enter="handleLogin">
              <NFormItem label="门户登录账号">
                <NInput
                  v-model:value="loginModel.username"
                  placeholder="请输入门户登录账号"
                  size="large"
                  :input-props="{ id: 'portal-login-username', name: 'portalUsername', 'aria-label': '门户登录账号' }"
                />
              </NFormItem>
              <NFormItem label="门户登录密码">
                <NInput
                  v-model:value="loginModel.password"
                  type="password"
                  show-password-on="click"
                  placeholder="请输入门户登录密码"
                  size="large"
                  :input-props="{ id: 'portal-login-password', name: 'portalPassword', 'aria-label': '门户登录密码' }"
                />
              </NFormItem>
              <NButton type="primary" size="large" block :loading="loginLoading" @click="handleLogin">
                登录渠道门户
              </NButton>
            </NForm>

            <div class="rounded-18px bg-[#f8fafc] px-16px py-14px text-13px leading-6 text-[#64748b]">
              当前页面不会再尝试读取后台管理员的渠道配置，因此不会因为浏览器中缺少后台令牌而触发
              <code>401</code>
              。
            </div>
          </div>
        </NCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.portal-login {
  background:
    radial-gradient(circle at top left, rgb(45 212 191 / 0.18), transparent 32%),
    radial-gradient(circle at right 18% top 12%, rgb(14 165 233 / 0.18), transparent 28%),
    linear-gradient(180deg, #f0fdfa 0%, #f8fafc 48%, #eff6ff 100%);
}

.hero-card,
.login-card {
  border-radius: 28px;
  box-shadow: 0 22px 60px rgb(15 23 42 / 0.08);
}

.hero-card {
  background: linear-gradient(135deg, rgb(255 255 255 / 0.92) 0%, rgb(240 253 250 / 0.94) 100%);
}

.login-card {
  background: linear-gradient(180deg, rgb(255 255 255 / 0.96) 0%, rgb(248 250 252 / 0.98) 100%);
}

.feature-card {
  padding: 16px;
  border: 1px solid rgb(148 163 184 / 0.18);
  border-radius: 20px;
  background: rgb(255 255 255 / 0.82);
}

.feature-card__title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.feature-card__desc {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #64748b;
}
</style>
