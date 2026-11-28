import { Download, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WarehouseScope } from '../../../app/use-warehouse-scope';
import { QueryState } from '../../../shared/ui/QueryState';
import { useOfficeFile, usePrivateFile } from '../../files/files-api';
import { useBlobUrl } from '../../files/use-blob-url';
import styles from '../pages/Imports.module.css';

const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function InvoiceSource({ scope, fileId }: { scope: WarehouseScope; fileId: string }) {
  const { t } = useTranslation();
  const file = useOfficeFile(scope, fileId);
  const content = usePrivateFile(scope, fileId);
  const url = useBlobUrl(content.data);
  const name = file.data?.originalName || fileId;
  const type = file.data?.contentType ?? content.data?.type;
  const [failed, setFailed] = useState<Blob>();
  return <section className={'surface ' + styles.source}>
    <div className={styles.heading}>
      <h2>{t('importSource')}</h2>
      {url && <a className="button" href={url} download={name}><Download size={15} aria-hidden="true" />{t('importDownload')}</a>}
    </div>
    <p className={styles.file}><FileText size={18} aria-hidden="true" /><bdi>{name}</bdi></p>
    <QueryState query={content}>
      <div className={styles.preview} tabIndex={0} role="region" aria-label={t('importSource')}>
        {content.data && url && (type === xlsxType ? <SpreadsheetPreview blob={content.data} /> :
          type?.startsWith('image/') && content.data !== failed ?
            <img src={url} alt={name} onError={() => setFailed(content.data)} /> :
            <p className={styles.notice}>{t('importPreviewUnavailable')}</p>)}
      </div>
    </QueryState>
  </section>;
}

type Sheet = { name: string; rows: string[][] };
function SpreadsheetPreview({ blob }: { blob: Blob }) {
  const { t } = useTranslation();
  const [result, setResult] = useState<{ blob: Blob; sheets: Sheet[] }>();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let current = true;
    async function load() {
      try {
        const { default: ExcelJS } = await import('exceljs');
        const book = new ExcelJS.Workbook();
        await book.xlsx.load(await blob.arrayBuffer());
        const sheets = book.worksheets.slice(0, 10).map(sheet => ({
          name: sheet.name,
          rows: Array.from({ length: Math.min(sheet.rowCount, 50) }, (_, row) =>
            Array.from({ length: Math.min(sheet.columnCount, 16) }, (_, column) =>
              sheet.getCell(row + 1, column + 1).text.slice(0, 500))),
        }));
        if (current) { setIndex(0); setResult({ blob, sheets }); }
      } catch {
        if (current) setResult({ blob, sheets: [] });
      }
    }
    void load();
    return () => { current = false; };
  }, [blob]);
  if (result?.blob !== blob) return <p className={styles.notice} role="status">{t('loadingRecords')}</p>;
  const sheet = result.sheets[index];
  if (!sheet?.rows.length) return <p className={styles.notice}>{t('importPreviewUnavailable')}</p>;
  return <>
    {result.sheets.length > 1 && <select className="text-input" aria-label={t('importSheet')} value={index}
      onChange={event => setIndex(Number(event.target.value))}>
      {result.sheets.map((item, i) => <option key={item.name} value={i}>{item.name}</option>)}
    </select>}
    <table className="records-table" dir="ltr"><caption className="sr-only">{sheet.name}</caption>
      <thead><tr><th scope="col">#</th>{sheet.rows[0].map((_, col) => <th scope="col" key={col}>{String.fromCharCode(65 + col)}</th>)}</tr></thead>
      <tbody>{sheet.rows.map((row, i) => <tr key={i}><th scope="row">{i + 1}</th>
        {row.map((value, col) => <td key={col}><bdi>{value}</bdi></td>)}</tr>)}</tbody>
    </table>
    <p className={'muted-text ' + styles.notice}>{t('importPreviewLimit')}</p>
  </>;
}
