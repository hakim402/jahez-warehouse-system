import {
  createPaginatedRowModel, rowPaginationFeature, tableFeatures, useTable, type ColumnDef,
} from '@tanstack/react-table';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const features = tableFeatures({ rowPaginationFeature, paginatedRowModel: createPaginatedRowModel() });
const pageSize = 8;

export type RecordColumn<T extends { id: string }> = ColumnDef<typeof features, T>;

export function DataTable<T extends { id: string }>({ records, columns, label }: {
  records: T[];
  columns: RecordColumn<T>[];
  label: string;
}) {
  const { t, i18n } = useTranslation();
  const table = useTable({
    features, data: records, columns, getRowId: (row) => row.id,
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });
  const { pageIndex } = table.state.pagination;
  const pageCount = table.getPageCount();
  const firstPage = Math.max(0, Math.min(pageIndex - 1, pageCount - 3));
  const pages = Array.from({ length: Math.min(pageCount, 3) }, (_, index) => firstPage + index);
  const number = new Intl.NumberFormat(i18n.resolvedLanguage);
  const rtl = i18n.dir() === 'rtl';
  const Previous = rtl ? ArrowRight : ArrowLeft;
  const Next = rtl ? ArrowLeft : ArrowRight;

  return (
    <>
      <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
        <table className="records-table">
          <caption className="sr-only">{label}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} scope="col"><table.FlexRender header={header} /></th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => <td key={cell.id}><table.FlexRender cell={cell} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span aria-live="polite">{t('showingRecords', {
          first: number.format(pageIndex * pageSize + 1),
          last: number.format(Math.min((pageIndex + 1) * pageSize, records.length)),
          total: number.format(records.length),
        })}</span>
        {pageCount > 1 && (
          <nav aria-label={t('pagination')} className="pagination">
            <button type="button" aria-label={t('previousPage')} disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}><Previous size={14} aria-hidden="true" /></button>
            {pages.map((page) => (
              <button type="button" key={page} aria-label={t('pageNumber', { number: number.format(page + 1) })}
                aria-current={page === pageIndex ? 'page' : undefined} onClick={() => table.setPageIndex(page)}>
                {number.format(page + 1)}
              </button>
            ))}
            <button type="button" aria-label={t('nextPage')} disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}><Next size={14} aria-hidden="true" /></button>
          </nav>
        )}
      </div>
    </>
  );
}
