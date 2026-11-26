import { Workbook } from 'exceljs';
import { DraftLine, emptyDraft, field, InvoiceDraft } from './ingestion.types';

// Column and label keywords in English, Chinese, and Arabic so the client's own sheets map directly.
const LINE_COLUMNS: { key: keyof DraftLine; keywords: string[]; numeric: boolean }[] = [
  { key: 'description', keywords: ['product', 'description', 'item', 'name', '产品', '品名', 'المنتج'], numeric: false },
  { key: 'brand', keywords: ['brand', '品牌', 'العلامة'], numeric: false },
  { key: 'size', keywords: ['size', '尺寸', 'المقاس'], numeric: false },
  { key: 'cartons', keywords: ['cartons', 'carton', 'ctns', '箱数', 'كراتين'], numeric: true },
  { key: 'qtyPerCarton', keywords: ['qty/carton', 'qty per carton', 'per carton', '每箱', 'الكمية/كرتون'], numeric: true },
  { key: 'unitPrice', keywords: ['unit price', 'price', '单价', 'سعر'], numeric: true },
  { key: 'amount', keywords: ['amount', '金额', 'المبلغ'], numeric: true },
  { key: 'cbm', keywords: ['cbm', 'volume', '体积', 'الحجم'], numeric: true },
];

const HEADER_LABELS: { key: 'supplierName' | 'customerName' | 'currency' | 'totalAmount' | 'orderDate'; keywords: string[]; numeric: boolean }[] = [
  { key: 'supplierName', keywords: ['supplier', 'vendor', '供应商', 'المورد'], numeric: false },
  { key: 'customerName', keywords: ['customer', 'buyer', '客户', 'العميل'], numeric: false },
  { key: 'currency', keywords: ['currency', '币种', 'العملة'], numeric: false },
  { key: 'totalAmount', keywords: ['total', '合计', '总计', 'الإجمالي'], numeric: true },
  { key: 'orderDate', keywords: ['date', '日期', 'التاريخ'], numeric: false },
];

const PARSED_CONFIDENCE = 0.9;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof v.text === 'string') return v.text;
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return cellText(v.result);
    return '';
  }
  return String(value);
}
function cellNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = cellText(value).replace(/[^0-9.\-]/g, '');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
function matches(text: string, keywords: string[]): boolean {
  const t = text.trim().toLowerCase().replace(/[:：]/g, '');
  return keywords.some((k) => t === k.toLowerCase() || t.includes(k.toLowerCase()));
}

/** Parses an .xlsx buffer into a draft by matching column headers and label:value pairs. */
export async function parseXlsx(buffer: Buffer): Promise<InvoiceDraft> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];
  const draft = emptyDraft();
  if (!worksheet) return draft;

  const rows: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => cells.push(cell.value));
    rows.push(cells);
  });

  // Find the header row: the first row matching at least two line-column keywords.
  let headerIndex = -1;
  let colMap: Partial<Record<keyof DraftLine, number>> = {};
  for (let i = 0; i < rows.length; i++) {
    const map: Partial<Record<keyof DraftLine, number>> = {};
    rows[i].forEach((cell, colIndex) => {
      const text = cellText(cell);
      if (!text) return;
      for (const column of LINE_COLUMNS) {
        if (map[column.key] === undefined && matches(text, column.keywords)) map[column.key] = colIndex;
      }
    });
    if (Object.keys(map).length >= 2) { headerIndex = i; colMap = map; break; }
  }

  // Header label:value pairs, scanned only in rows above the detected table header so column names
  // like "Size" are never mistaken for invoice header labels.
  const headerScanRows = rows.slice(0, headerIndex >= 0 ? headerIndex : rows.length);
  for (const row of headerScanRows) {
    for (let c = 0; c < row.length; c++) {
      const label = cellText(row[c]);
      if (!label) continue;
      for (const h of HEADER_LABELS) {
        if (!matches(label, h.keywords)) continue;
        const neighbor = row[c + 1];
        const value = h.numeric ? cellNumber(neighbor) : (cellText(neighbor) || null);
        const current = draft.header[h.key] as { value: unknown };
        if (value !== null && value !== '' && current.value === null) {
          draft.header[h.key] = field(value as never, PARSED_CONFIDENCE, 'xlsx') as never;
        }
      }
    }
  }

  if (headerIndex >= 0) {
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const read = (key: keyof DraftLine, numeric: boolean) => {
        const idx = colMap[key];
        if (idx === undefined) return null;
        return numeric ? cellNumber(row[idx]) : (cellText(row[idx]) || null);
      };
      const description = read('description', false);
      const cartons = read('cartons', true);
      const looksLikeTotal = matches(cellText(description), ['total', '合计', 'الإجمالي']);
      if (looksLikeTotal || (description === null && cartons === null)) continue;
      const line: DraftLine = {
        description: field(description as string | null, description ? PARSED_CONFIDENCE : 0.3, 'xlsx'),
        brand: field(read('brand', false) as string | null, PARSED_CONFIDENCE, 'xlsx'),
        size: field(read('size', false) as string | null, PARSED_CONFIDENCE, 'xlsx'),
        cartons: field(cartons as number | null, cartons !== null ? PARSED_CONFIDENCE : 0.3, 'xlsx'),
        qtyPerCarton: field(read('qtyPerCarton', true) as number | null, PARSED_CONFIDENCE, 'xlsx'),
        unitPrice: field(read('unitPrice', true) as number | null, PARSED_CONFIDENCE, 'xlsx'),
        amount: field(read('amount', true) as number | null, PARSED_CONFIDENCE, 'xlsx'),
        cbm: field(read('cbm', true) as number | null, PARSED_CONFIDENCE, 'xlsx'),
        productId: null,
      };
      draft.lines.push(line);
    }
  }
  return draft;
}
