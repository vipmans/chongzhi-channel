export type ParsedBatchRow = {
  lineNo: number;
  channelOrderNo: string;
  mobile: string;
  faceValue: number;
  productType: Api.Portal.ProductType | '';
  rawLine: string;
};

const carrierLabelMap: Record<string, string> = {
  CMCC: '中国移动',
  CTCC: '中国电信',
  CUCC: '中国联通',
  CBN: '中国广电'
};

const headerAliasSet = new Set([
  'channelorderno',
  'orderno',
  '订单号',
  '渠道订单号',
  'mobile',
  '手机号',
  '号码',
  'facevalue',
  'amount',
  '充值金额',
  '面值',
  'producttype',
  '充值类型',
  '产品类型'
]);

export function createPortalOrderNo(prefix = 'portal') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getCarrierLabel(code?: string | null) {
  if (!code) {
    return '--';
  }

  return carrierLabelMap[code] || code;
}

export function inferProvinceFromProductName(name?: string | null) {
  if (!name) {
    return '--';
  }

  const match = name.match(/^(.+?)(移动|联通|电信|广电)/);

  return match?.[1]?.trim() || '--';
}

export function inferProductType(text?: string | null): Api.Portal.ProductType | '' {
  const normalized = String(text || '').toLowerCase();

  if (!normalized) {
    return '';
  }

  if (normalized.includes('fast') || normalized.includes('快充')) {
    return 'FAST';
  }

  if (normalized.includes('mixed') || normalized.includes('混充')) {
    return 'MIXED';
  }

  return '';
}

export function formatAmountYuan(value?: number | null, currency = 'CNY') {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  const amount = Number(value).toFixed(2);

  if (currency === 'CNY') {
    return `${amount} 元`;
  }

  return `${amount} ${currency}`;
}

export function maskSecret(value?: string | null, reveal = false) {
  if (!value) {
    return '--';
  }

  if (reveal || value === '******') {
    return value;
  }

  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }

  return `${value.slice(0, 2)}${'*'.repeat(Math.max(2, value.length - 4))}${value.slice(-2)}`;
}

export function renderNullable(value?: string | null) {
  return value || '--';
}

export function serializeCsv(rows: (string | number | boolean | null | undefined)[][]) {
  return rows
    .map(row =>
      row
        .map(cell => {
          const text = String(cell ?? '');
          const escaped = text.replaceAll('"', '""');

          if (/[",\n]/.test(text)) {
            return `"${escaped}"`;
          }

          return escaped;
        })
        .join(',')
    )
    .join('\n');
}

export function downloadCsv(filename: string, rows: (string | number | boolean | null | undefined)[][]) {
  const csvContent = `\uFEFF${serializeCsv(rows)}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });

  downloadBlob(filename, blob);
}

export async function downloadTemplateWorkbook(fileName: string, csvContent: string) {
  const rows = csvContent
    .trim()
    .split(/\r?\n/)
    .map(line => line.split(','));

  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  XLSX.utils.book_append_sheet(workbook, worksheet, '批量充值模板');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  downloadBlob(fileName, blob);
}

export async function readBatchFile(file: File) {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
      header: 1,
      raw: false,
      defval: ''
    });

    return rows.map(row => row.map(cell => String(cell ?? '').trim()).join(',')).join('\n');
  }

  return file.text();
}

export function parseBatchText(content: string) {
  const errors: string[] = [];
  const rows: ParsedBatchRow[] = [];
  const normalizedLines = content
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  normalizedLines.forEach((line, index) => {
    const cells = splitLine(line).map(cell => cell.trim());

    if (!cells.length) {
      return;
    }

    if (index === 0 && isHeaderRow(cells)) {
      return;
    }

    const lineNo = index + 1;
    const parsed = parseLineCells(cells);

    if (!parsed) {
      errors.push(
        `第 ${lineNo} 行格式不正确，请使用“手机号,充值金额[,产品类型]”或“渠道订单号,手机号,充值金额[,产品类型]”`
      );
      return;
    }

    const { channelOrderNo, mobile, faceValue, productType } = parsed;

    if (!/^\d{11}$/.test(mobile)) {
      errors.push(`第 ${lineNo} 行手机号格式不正确：${mobile}`);
      return;
    }

    if (!Number.isFinite(faceValue) || faceValue <= 0) {
      errors.push(`第 ${lineNo} 行充值金额不正确：${parsed.faceValueText}`);
      return;
    }

    rows.push({
      lineNo,
      channelOrderNo: channelOrderNo || createPortalOrderNo(`batch-${lineNo}`),
      mobile,
      faceValue,
      productType,
      rawLine: line
    });
  });

  return {
    rows,
    errors,
    normalizedText: normalizedLines.join('\n')
  };
}

function splitLine(line: string) {
  const normalized = line.replace(/[，|]/g, ',');

  if (normalized.includes('\t')) {
    return normalized.split('\t');
  }

  if (normalized.includes(',')) {
    return normalized.split(',');
  }

  return normalized.split(/\s+/);
}

function isHeaderRow(cells: string[]) {
  return cells.some(cell => headerAliasSet.has(normalizeHeader(cell)));
}

function normalizeHeader(value: string) {
  return value.replace(/[\s_-]/g, '').toLowerCase();
}

function parseLineCells(cells: string[]) {
  if (cells.length < 2) {
    return null;
  }

  if (/^\d{11}$/.test(cells[0]) && parseFaceValue(cells[1]) !== null) {
    return {
      channelOrderNo: '',
      mobile: cells[0],
      faceValue: parseFaceValue(cells[1]) ?? 0,
      faceValueText: cells[1],
      productType: normalizeProductType(cells[2])
    };
  }

  if (cells.length >= 3 && /^\d{11}$/.test(cells[1]) && parseFaceValue(cells[2]) !== null) {
    return {
      channelOrderNo: cells[0],
      mobile: cells[1],
      faceValue: parseFaceValue(cells[2]) ?? 0,
      faceValueText: cells[2],
      productType: normalizeProductType(cells[3])
    };
  }

  return null;
}

function parseFaceValue(value: string) {
  const normalized = value.replace(/[^\d.]/g, '');

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function normalizeProductType(value?: string) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();

  if (normalized === 'FAST' || normalized === 'MIXED') {
    return normalized as Api.Portal.ProductType;
  }

  return inferProductType(normalized);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
