import dayjs from 'dayjs';

export function formatDateTime(value?: string | null, pattern = 'YYYY-MM-DD HH:mm:ss') {
  if (!value) {
    return '--';
  }

  return dayjs(value).format(pattern);
}

export function formatFen(value?: number | null, currency = 'CNY') {
  if (value === null || value === undefined) {
    return '--';
  }

  const amount = (value / 100).toFixed(2);

  if (currency === 'CNY') {
    return `￥${amount}`;
  }

  return `${amount} ${currency}`;
}

export function yuanToFen(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }

  return Math.round(value * 100);
}

export function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function getStatusTagType(value?: string | null): NaiveUI.ThemeColor {
  const normalized = String(value || '').toLowerCase();

  if (!normalized) {
    return 'default';
  }

  if (
    normalized.includes('success') ||
    normalized.includes('active') ||
    normalized.includes('enabled') ||
    normalized.includes('healthy') ||
    normalized.includes('normal')
  ) {
    return 'success';
  }

  if (
    normalized.includes('pending') ||
    normalized.includes('review') ||
    normalized.includes('warning') ||
    normalized.includes('processing')
  ) {
    return 'warning';
  }

  if (
    normalized.includes('error') ||
    normalized.includes('fail') ||
    normalized.includes('disabled') ||
    normalized.includes('inactive') ||
    normalized.includes('closed')
  ) {
    return 'error';
  }

  return 'info';
}
