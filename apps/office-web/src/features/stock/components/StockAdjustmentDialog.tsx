import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../api/client';
import { useRecordFormat } from '../../../shared/format-record';
import { normalizeNumericInput } from '../../../shared/number-input';
import { LabeledField } from '../../../shared/ui/LabeledField';
import { OfficeDialog } from '../../../shared/ui/OfficeDialog';
import { uploadOfficeFile, type OfficeFile } from '../../files/files-api';
import { productName, useCatalog } from '../../catalog/catalog-api';
import type { useOrderScope } from '../../orders/order-api';
import { compareStockCounts, formatStockCount, shareStockCount } from '../stock-count';
import { recordStockAdjustment, useStockLots, type AdjustmentInput, type StockLot } from '../adjustments-api';
import type { StockRow } from '../warehouse-api';
import styles from './StockAdjustmentDialog.module.css';

const maxPhotoBytes = 15 * 1024 * 1024;
const photoTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export function StockAdjustmentDialog({ stock, scope, onClose }: {
  stock: StockRow;
  scope: ReturnType<typeof useOrderScope>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const cache = useQueryClient();
  const catalog = useCatalog();
  const lots = useStockLots(scope, stock);
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [cartons, setCartons] = useState('');
  const [qty, setQty] = useState('');
  const [cbm, setCbm] = useState('');
  const [lotId, setLotId] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<OfficeFile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [failureDetails, setFailureDetails] = useState<string[]>([]);
  const [submissionUnknown, setSubmissionUnknown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const operationId = useRef(crypto.randomUUID());
  const uploadId = useRef(crypto.randomUUID());
  const lastPayload = useRef<string | undefined>(undefined);
  const selectedLot = lots.data?.find((lot) => lot.receiptLineId === lotId);
  const product = catalog.data?.products.find((item) => item.id === stock.productId);
  const available = selectedLot?.cartons ?? stock.cartons;
  const sign = direction === 'increase' ? 1 : -1;
  const enteredCartons = positiveInteger(cartons);
  const lotQty = selectedLot && enteredCartons
    ? shareStockCount(selectedLot.receivedQty, enteredCartons, selectedLot.receivedCartons, 0)
    : null;
  const lotCbm = selectedLot && enteredCartons
    ? shareStockCount(selectedLot.receivedCbm, enteredCartons, selectedLot.receivedCartons, 6)
    : null;

  const update = (field: 'cartons' | 'qty' | 'cbm' | 'lotId' | 'reason' | 'note', value: string) => {
    if (field === 'cartons') setCartons(value);
    if (field === 'qty') setQty(value);
    if (field === 'cbm') setCbm(value);
    if (field === 'lotId') { setLotId(value); setQty(''); setCbm(''); }
    if (field === 'reason') setReason(value);
    if (field === 'note') setNote(value);
    setErrors((current) => ({ ...current, [field]: '' }));
    setFailure(undefined);
    setFailureDetails([]);
  };

  function selectPhoto(file: File | null) {
    setPhoto(null); setUploadedPhoto(null); uploadId.current = crypto.randomUUID();
    if (file && file.size > maxPhotoBytes) { setErrors((current) => ({ ...current, photo: t('photoTooLarge') })); return; }
    if (file && file.type && !photoTypes.has(file.type)) { setErrors((current) => ({ ...current, photo: t('photoTypeInvalid') })); return; }
    setPhoto(file);
    setErrors((current) => ({ ...current, photo: '' })); setFailure(undefined); setFailureDetails([]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const nextErrors: Record<string, string> = {};
    const cartonValue = enteredCartons;
    if (!cartonValue) nextErrors.cartons = t('adjustmentCartonsInvalid');
    else if (direction === 'decrease' && (compareStockCounts(available, cartonValue) ?? 0) < 0) {
      nextErrors.cartons = t('adjustmentExceedsAvailable', { available: formatStockCount(available, format.language) });
    }
    if (lotId) {
      if (!selectedLot) nextErrors.lotId = t('invalidSelection');
      else {
        if (selectedLot.receivedQty !== null && !positiveInteger(lotQty ?? '')) nextErrors.qty = t('adjustmentQuantityInvalid');
        const derivedCbm = positiveDecimal(lotCbm ?? '');
        if (selectedLot.receivedCbm !== null && (!derivedCbm || derivedCbm >= 1_000_000)) nextErrors.cbm = t('adjustmentCbmInvalid');
      }
    } else {
      if (qty && !positiveInteger(qty)) nextErrors.qty = t('adjustmentQuantityInvalid');
      const enteredCbm = positiveDecimal(cbm);
      if (cbm && (!enteredCbm || enteredCbm >= 1_000_000)) nextErrors.cbm = t('adjustmentCbmInvalid');
    }
    if (!reason.trim()) nextErrors.reason = t('adjustmentReasonRequired');
    if (!photo) nextErrors.photo = t('adjustmentPhotoRequired');
    setErrors(nextErrors);
    setFailure(undefined);
    setFailureDetails([]);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    let posting = false;
    try {
      let photoFile = uploadedPhoto;
      if (!photoFile) {
        photoFile = await uploadOfficeFile({
          warehouseId: scope.warehouseId!, uploadId: uploadId.current, purpose: 'adjustment_photo', file: photo!,
        });
        setUploadedPhoto(photoFile);
      }
      const input: AdjustmentInput = {
        clientOperationId: operationId.current,
        warehouseId: scope.warehouseId!,
        reason: reason.trim(),
        photoFileId: photoFile.id,
        cartons: sign * cartonValue!,
        qty: lotId ? (lotQty ? sign * positiveInteger(lotQty)! : null) : qty ? sign * positiveInteger(qty)! : null,
        cbm: lotId ? (lotCbm ? sign * positiveDecimal(lotCbm)! : null) : cbm ? sign * positiveDecimal(cbm)! : null,
        note: note.trim() || null,
        receiptLineId: lotId || null,
        ...(!lotId ? {
          customerId: stock.customerId, supplierId: stock.supplierId, brand: stock.brand, productId: stock.productId,
        } : {}),
      };
      const signature = JSON.stringify(input);
      if (lastPayload.current && lastPayload.current !== signature) operationId.current = crypto.randomUUID();
      input.clientOperationId = operationId.current;
      lastPayload.current = JSON.stringify(input);
      posting = true;
      await recordStockAdjustment(input);
      await Promise.allSettled([
        cache.invalidateQueries({ queryKey: ['warehouse-data'] }),
        cache.invalidateQueries({ queryKey: ['stock-lots'] }),
        cache.invalidateQueries({ queryKey: ['dashboard-history'] }),
      ]);
      onClose();
    } catch (error) {
      if (!posting) {
        setFailure(t('adjustmentUploadFailed'));
      } else if (isUnknownAdjustmentResult(error)) {
        setSubmissionUnknown(true);
        setFailure(t('adjustmentResultUnknown'));
      } else {
        setSubmissionUnknown(false);
        if (error instanceof ApiError && error.status === 409 && error.available !== null && error.requested !== null && error.shortage !== null) {
          setFailure(t('adjustmentOverdraw', {
            available: formatStockCount(error.available, format.language),
            requested: formatStockCount(error.requested, format.language),
            shortage: formatStockCount(error.shortage, format.language),
          }));
        } else if (error instanceof ApiError && error.status === 403) {
          setFailure(t('restricted'));
        } else if (error instanceof ApiError && [400, 409].includes(error.status)) {
          setFailure(t('validationFailed'));
          setFailureDetails(error.validationMessages);
        } else {
          setFailure(t('adjustmentFailed'));
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return <OfficeDialog title={t('adjustStock')} onClose={onClose} busy={busy} closeDisabled={submissionUnknown} wide>
    <form onSubmit={submit} noValidate>
      <fieldset className={'office-dialog-body ' + styles.fields} disabled={busy || submissionUnknown}>
        <div className={styles.stockSummary}>
          <div><strong>{productName(product, format.language) || stock.productId || '—'}</strong><span>{stock.customerName || '—'} · {stock.supplierName || '—'}</span></div>
          <dl><div><dt>{t('cartons')}</dt><dd>{formatStockCount(stock.cartons, format.language)}</dd></div><div><dt>{t('units')}</dt><dd>{formatStockCount(stock.qty, format.language)}</dd></div><div><dt>{t('volume')}</dt><dd>{stock.cbm === null ? '—' : formatStockCount(stock.cbm, format.language)}</dd></div></dl>
        </div>
        <fieldset className={styles.direction}>
          <legend>{t('adjustmentDirection')}</legend>
          <label><input type="radio" name="direction" value="increase" checked={direction === 'increase'} onChange={() => { setDirection('increase'); setErrors((current) => ({ ...current, cartons: '' })); setFailure(undefined); }} /><span>{t('increase')}</span></label>
          <label><input type="radio" name="direction" value="decrease" checked={direction === 'decrease'} onChange={() => { setDirection('decrease'); setErrors((current) => ({ ...current, cartons: '' })); setFailure(undefined); }} /><span>{t('decrease')}</span></label>
        </fieldset>
        <LabeledField label={t('receiptLot')} hint={t('optional')} error={errors.lotId}>
          {(attributes) => <select {...attributes} value={lotId} onChange={(event) => update('lotId', event.target.value)}>
            <option value="">{t('stockGroup')}</option>
            {(lots.data ?? []).map((lot) => <option key={lot.receiptLineId} value={lot.receiptLineId}>
              {lot.receiptNo || lot.receiptLineId}{lot.brand ? ` · ${lot.brand}` : ''} · {formatStockCount(lot.cartons, format.language)} {t('cartons')}
            </option>)}
          </select>}
        </LabeledField>
        {lots.isError && <p className="field-error" role="alert">{t('lotsLoadFailed')} <button type="button" className="button" onClick={() => { void lots.refetch(); }}>{t('retry')}</button></p>}
        {selectedLot && <LotSummary lot={selectedLot} />}
        <div className={styles.quantityGrid}>
          <LabeledField label={t('cartons')} hint={t('required')} error={errors.cartons}>
            {(attributes) => <input {...attributes} type="text" inputMode="numeric" autoComplete="off" dir="ltr" value={cartons} onChange={(event) => update('cartons', event.target.value)} />}
          </LabeledField>
          <LabeledField label={t('units')} hint={lotId ? t('lotDimensionsAutomatic') : t('optional')} error={errors.qty}>
            {(attributes) => <input {...attributes} type="text" inputMode="numeric" autoComplete="off" dir="ltr" value={lotId ? lotQty ?? '' : qty} disabled={Boolean(lotId)} onChange={(event) => update('qty', event.target.value)} />}
          </LabeledField>
          <LabeledField label={t('volume')} hint={lotId ? t('lotDimensionsAutomatic') : t('optional')} error={errors.cbm}>
            {(attributes) => <input {...attributes} type="text" inputMode="decimal" autoComplete="off" dir="ltr" value={lotId ? lotCbm ?? '' : cbm} disabled={Boolean(lotId)} onChange={(event) => update('cbm', event.target.value)} />}
          </LabeledField>
        </div>
        <p className={styles.helper}>{t('adjustmentQuantityHelp')}</p>
        <LabeledField label={t('adjustmentReason')} hint={t('required')} error={errors.reason}>
          {(attributes) => <textarea {...attributes} rows={3} maxLength={2000} value={reason} onChange={(event) => update('reason', event.target.value)} />}
        </LabeledField>
        <LabeledField label={t('adjustmentPhoto')} hint={t('required')} error={errors.photo}>
          {(attributes) => <div className={styles.photoField}>
            <input {...attributes} className={styles.photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)} />
            <label htmlFor={attributes.id} className={styles.photoDropzone} data-drag={dragOver ? 'true' : undefined}
              onDragOver={(event) => { if (busy || submissionUnknown) return; event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                if (busy || submissionUnknown) return;
                event.preventDefault(); setDragOver(false);
                selectPhoto(event.dataTransfer.files?.[0] ?? null);
              }}>
              <Upload size={18} aria-hidden="true" />
              <span className={styles.photoChoose}>{t('chooseFile')}</span>
              <span>{t('dragFileHere')}</span>
            </label>
            <PhotoPreview file={photo} />
          </div>}
        </LabeledField>
        <LabeledField label={t('note')} hint={t('optional')}>
          {(attributes) => <textarea {...attributes} rows={3} maxLength={2000} value={note} onChange={(event) => update('note', event.target.value)} />}
        </LabeledField>
        {failure && <p className="field-error" role="alert">{failure}</p>}
        {failureDetails.length > 0 && <ul className="field-error">{failureDetails.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
      </fieldset>
      <div className="office-dialog-actions">
        <button type="button" className="button" disabled={busy || submissionUnknown} onClick={onClose}>{t('cancel')}</button>
        <button type="submit" className="button button-primary" disabled={busy}>{busy ? t('saving') : submissionUnknown ? t('retryAdjustment') : t('recordAdjustment')}</button>
      </div>
    </form>
  </OfficeDialog>;
}

function LotSummary({ lot }: { lot: StockLot }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  return <div className={styles.lotSummary}><strong>{lot.receiptNo || lot.receiptLineId}</strong>{lot.brand && <span><bdi>{lot.brand}</bdi></span>}<span>{t('available')}: {formatStockCount(lot.cartons, format.language)} {t('cartons')}</span><span>{t('units')}: {formatStockCount(lot.qty, format.language)}</span><span>{t('volume')}: {formatStockCount(lot.cbm, format.language)}</span><span>{format.dateTime(lot.receivedAt)}</span></div>;
}

function PhotoPreview({ file }: { file: File | null }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    setUrl(undefined);
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (!file) return null;
  return <div className={styles.photoPreview}>{url && file.type.startsWith('image/') ? <img src={url} alt={file.name} /> : <ImagePlus size={22} aria-hidden="true" />}<span>{file.name}</span></div>;
}

function positiveInteger(value: string) {
  const text = normalizeNumericInput(value);
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : null;
}

function positiveDecimal(value: string) {
  const text = normalizeNumericInput(value);
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isUnknownAdjustmentResult(error: unknown) {
  return error instanceof TypeError || error instanceof SyntaxError ||
    (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) ||
    (error instanceof ApiError && (error.status === 408 || error.status >= 500));
}
