import { Row, Workbook } from 'exceljs';

export interface ReportColumn {
  header: string;
  key: string;
  width?: number;
  /** ExcelJS number format applied to every cell in the column, e.g. '#,##0.000'. */
  numFmt?: string;
}

export interface ReportSheet {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  /** Optional bold totals row keyed by column key. Only keys present here are filled. */
  totals?: Record<string, unknown>;
}

/**
 * Renders a report sheet to an xlsx buffer with a frozen, styled header row so phone and laptop
 * downloads are byte-identical. Number formats come from the column definitions, keeping the
 * builders free of styling concerns.
 */
export async function buildWorkbook(sheet: ReportSheet): Promise<Buffer> {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 1 }] });

  worksheet.columns = sheet.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? 18,
  }));

  const header = worksheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
  header.alignment = { vertical: 'middle' };
  header.commit();

  for (const row of sheet.rows) {
    const added = worksheet.addRow(row);
    applyFormats(added, sheet.columns);
  }

  if (sheet.totals) {
    const totals = worksheet.addRow(sheet.totals);
    totals.font = { bold: true };
    applyFormats(totals, sheet.columns);
    totals.commit();
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function applyFormats(row: Row, columns: ReportColumn[]) {
  for (const column of columns) {
    if (column.numFmt) row.getCell(column.key).numFmt = column.numFmt;
  }
}

export const CBM_FORMAT = '#,##0.000';
export const WEIGHT_FORMAT = '#,##0.000';
export const QTY_FORMAT = '#,##0';
export const MONEY_FORMAT = '#,##0.00';
