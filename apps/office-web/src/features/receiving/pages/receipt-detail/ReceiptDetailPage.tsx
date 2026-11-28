import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../../api/client';
import { useRecordFormat } from '../../../../shared/format-record';
import { DataTable, type RecordColumn } from '../../../../shared/ui/DataTable';
import { RecordState } from '../../../../shared/ui/RecordState';
import { StatusBadge } from '../../../../shared/ui/StatusBadge';
import { partyName, productName, useCatalog } from '../../../catalog/catalog-api';
import { WarehouseState } from '../../../../shared/ui/WarehouseState';
import { useOrder, type OrderLine } from '../../../orders/order-api';
import { useWarehouseScope } from '../../../../app/use-warehouse-scope';
import { formatStockCount, stockCountSign, subtractStockCounts, sumStockCounts } from '../../../stock/stock-count';
import { FindingReviewDialog } from '../../components/FindingReviewDialog';
import type { Finding } from '../../receiving-api';
import { ReceiptEvidence } from '../../components/ReceiptEvidence';
import { useReceipt, useReceiptEvidence, type ReceiptLine } from '../../receiving-api';
import styles from './ReceiptDetailPage.module.css';

type ComparisonRow = {
  id: string;
  orderLine: OrderLine | null;
  receiptLines: ReceiptLine[];
  unmatched: boolean;
};

export default function ReceiptDetailPage() {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const { receiptId = '' } = useParams();
  const scope = useWarehouseScope();
  const [review, setReview] = useState<Finding | null>(null);
  const receipt = useReceipt(scope, receiptId);
  const order = useOrder(scope, receipt.data?.orderId ?? '');
  const evidence = useReceiptEvidence(scope, receipt.data);
  const catalog = useCatalog();
  if (!scope.canRead || !scope.warehouseId) return <WarehouseState active={scope.active} />;
  if (receipt.isError || order.isError) {
    const unavailable = [receipt.error, order.error].some((error) => error instanceof ApiError && [403, 404].includes(error.status));
    return <><Link to="/receiving" className="back-link"><ArrowLeft className="rtl-icon" size={15} aria-hidden="true" />{t('receiving')}</Link>
      <RecordState state="error" message={unavailable ? t('receiptUnavailable') : undefined} action={unavailable ? undefined : () => { void receipt.refetch(); void order.refetch(); }} /></>;
  }
  if (!receipt.data || !order.data) return <><Link to="/receiving" className="back-link"><ArrowLeft className="rtl-icon" size={15} aria-hidden="true" />{t('receiving')}</Link><RecordState state="loading" /></>;

  const record = receipt.data;
  const purchase = order.data;
  const supplier = catalog.data?.parties.find((party) => party.id === purchase.supplierId);
  const customer = catalog.data?.parties.find((party) => party.id === purchase.customerId);
  const rows: ComparisonRow[] = comparisonRows(purchase.lines, record.lines);
  const orderedCartons = sumStockCounts(purchase.lines.map((line) => line.cartons));
  const receivedCartons = sumStockCounts(record.lines.map((line) => line.cartons));
  const openFindings = record.findings.filter((finding) => finding.status === 'open');
  const columns: RecordColumn<ComparisonRow>[] = [
    { id: 'product', header: t('product'), cell: ({ row }) => {
      const productId = row.original.orderLine?.productId ?? row.original.receiptLines[0]?.productId;
      const product = catalog.data?.products.find((item) => item.id === productId);
      return <><bdi>{productName(product, format.language) || productId || '—'}</bdi>
        {(row.original.unmatched || row.original.orderLine?.brand || row.original.receiptLines[0]?.brand) && <span className="secondary-line">
          {row.original.unmatched && t('unmatchedLine')}{row.original.unmatched && ' · '}<bdi>{row.original.orderLine?.brand || row.original.receiptLines[0]?.brand || ''}</bdi>
        </span>}</>;
    } },
    { id: 'ordered', header: t('orderedCartons'), cell: ({ row }) => row.original.orderLine ? formatStockCount(row.original.orderLine.cartons, format.language) : '—' },
    { id: 'received', header: t('receivedCartons'), cell: ({ row }) => formatStockCount(sumStockCounts(row.original.receiptLines.map((line) => line.cartons)), format.language) },
    { id: 'difference', header: t('difference'), cell: ({ row }) => {
      const difference = row.original.orderLine ? subtractStockCounts(
        sumStockCounts(row.original.receiptLines.map((line) => line.cartons)), row.original.orderLine.cartons,
      ) : null;
      const sign = stockCountSign(difference);
      return <span className={styles.difference} data-sign={sign ?? undefined}>{formatStockCount(difference, format.language)}</span>;
    } },
    { id: 'cartonSize', header: t('cartonSize'), cell: ({ row }) => <MeasurementComparison
      ordered={row.original.orderLine?.size ?? '—'}
      received={receiptCartonSizes(row.original.receiptLines, format.language)} /> },
    { id: 'volume', header: t('volume'), cell: ({ row }) => <MeasurementComparison
      ordered={formatStockCount(row.original.orderLine?.cbm ?? null, format.language)}
      received={formatStockCount(row.original.receiptLines.length ? sumStockCounts(row.original.receiptLines.map((line) => line.cbm)) : null, format.language)} /> },
    { id: 'weight', header: t('weightKg'), cell: ({ row }) => <MeasurementComparison
      ordered={formatStockCount(row.original.orderLine?.weight ?? null, format.language)}
      received={formatStockCount(row.original.receiptLines.length ? sumStockCounts(row.original.receiptLines.map((line) => line.weightKg)) : null, format.language)} /> },
    { id: 'units', header: t('units'), cell: ({ row }) => formatStockCount(sumStockCounts(row.original.receiptLines.map((line) => line.qty)), format.language) },
    { id: 'condition', header: t('condition'), cell: ({ row }) => row.original.receiptLines.length
      ? <StatusBadge status={row.original.receiptLines.some((line) => line.condition === 'damaged') ? 'damaged' : 'ok'} />
      : '—' },
    { id: 'findings', header: t('discrepancies'), cell: ({ row }) => {
      const count = record.findings.filter((finding) => row.original.receiptLines.some((line) => line.id === finding.receiptLineId) ||
        (finding.orderLineId && finding.orderLineId === row.original.orderLine?.id)).length;
      return count ? format.quantity(count) : '—';
    } },
  ];
  return <div className={styles.receiptDetail}>
    <Link to="/receiving" className="back-link"><ArrowLeft className="rtl-icon" size={15} aria-hidden="true" />{t('receiving')}</Link>
    <div className="workspace-heading"><div className={styles.title}>
      <h1><bdi>{record.receiptNo}</bdi></h1><StatusBadge status={record.status} />
      <Link className="record-link" to={'/orders/' + purchase.id}>{t('orderNo')}: <bdi>{purchase.orderNo}</bdi></Link>
    </div></div>
    <div className={styles.layout}>
    <section className={'surface ' + styles.metadataPanel}><h2>{t('receiptDetails')}</h2>
    <dl className={'record-details ' + styles.metadata}>
      <div><dt>{t('supplier')}</dt><dd>{partyName(supplier, format.language) || '—'}</dd></div>
      <div><dt>{t('customer')}</dt><dd>{partyName(customer, format.language) || '—'}</dd></div>
      <div><dt>{t('shippingMark')}</dt><dd>{customer?.shippingMark || '—'}</dd></div>
      <div><dt>{t('receivedAt')}</dt><dd><time dateTime={record.receivedAt}>{format.dateTime(record.receivedAt)}</time></dd></div>
      <div><dt>{t('receivedBy')}</dt><dd><bdi>{record.receivedBy}</bdi></dd></div>
      <div><dt>{t('status')}</dt><dd>{purchase.status ? t(purchase.status) : '—'}</dd></div>
    </dl></section>
    <section className={'surface ' + styles.summary} aria-label={t('receiptSummary')}><h2>{t('receiptSummary')}</h2>
      <div><span>{t('orderedCartons')}</span><strong>{formatStockCount(orderedCartons, format.language)}</strong></div>
      <div><span>{t('receivedCartons')}</span><strong>{formatStockCount(receivedCartons, format.language)}</strong></div>
      <div><span>{t('openFindings')}</span><strong>{format.quantity(openFindings.length)}</strong></div>
    </section>
    <section className={'surface ' + styles.items} aria-labelledby="received-items">
      <h2 id="received-items" className="panel-heading">{t('receivedItems')}</h2>
      {rows.length ? <DataTable records={rows} columns={columns} label={t('receivedItems')} /> : <RecordState state="empty" />}
    </section>
    <section className={'surface ' + styles.section + ' ' + styles.findings} aria-labelledby="receipt-findings">
      <h2 id="receipt-findings">{t('discrepancies')}</h2>
      {record.findings.length ? <div className={styles.findingList}>{record.findings.map((finding) => <article className={styles.finding} key={finding.id}>
        <div><strong>{t(finding.type)}</strong><StatusBadge status={finding.status} /></div>
        <p>{t('expected')}: {formatStockCount(finding.expected, format.language)} · {t('actual')}: {formatStockCount(finding.actual, format.language)}</p>
        {finding.note && <p>{finding.note}</p>}
        {finding.status === 'open' && <button type="button" className="button button-primary" onClick={() => setReview({ ...finding, receiptId: record.id, warehouseId: record.warehouseId, resolvedBy: null })}>{t('review')}</button>}
      </article>)}</div> : <RecordState state="empty" message={t('noFindings')} />}
    </section>
    <section className={'surface ' + styles.section + ' ' + styles.evidence} aria-labelledby="receipt-evidence">
      <h2 id="receipt-evidence">{t('photoEvidence')}</h2>
      <ReceiptEvidence scope={scope} files={evidence.data} loading={evidence.isLoading} error={evidence.isError} retry={() => { void evidence.refetch(); }} />
    </section>
    </div>
    {review && <FindingReviewDialog finding={review} scope={scope} onClose={() => setReview(null)} />}
  </div>;
}

function MeasurementComparison({ ordered, received }: { ordered: string; received: string }) {
  const { t } = useTranslation();
  return <span className={styles.measurement}>
    <span className="sr-only">{t('ordered')}: </span><bdi>{ordered}</bdi>
    <span aria-hidden="true">→</span>
    <span className="sr-only">{t('received')}: </span><bdi>{received}</bdi>
  </span>;
}

function receiptCartonSizes(lines: ReceiptLine[], language: string): string {
  const sizes = lines.flatMap((line) => line.lengthCm === null || line.widthCm === null || line.heightCm === null
    ? []
    : [[line.lengthCm, line.widthCm, line.heightCm].map((value) => formatStockCount(value, language)).join(' × ')]);
  return sizes.length ? [...new Set(sizes)].join(' · ') : '—';
}

function comparisonRows(orderLines: OrderLine[], receiptLines: ReceiptLine[]): ComparisonRow[] {
  const used = new Set<string>();
  const rows = orderLines.map((orderLine): ComparisonRow => {
    let matches = receiptLines.filter((line) => !used.has(line.id) && line.orderLineId === orderLine.id && line.productId === orderLine.productId);
    if (!matches.length) {
      const fallback = receiptLines.find((line) => !used.has(line.id) && !line.orderLineId && line.productId === orderLine.productId &&
        line.brand === orderLine.brand && line.size === orderLine.size);
      if (fallback) matches = [fallback];
    }
    matches.forEach((line) => used.add(line.id));
    return { id: orderLine.id, orderLine, receiptLines: matches, unmatched: false };
  });
  for (const line of receiptLines) {
    if (!used.has(line.id)) rows.push({ id: line.id, orderLine: null, receiptLines: [line], unmatched: true });
  }
  return rows;
}
