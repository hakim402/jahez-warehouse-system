import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { normalizeNumericInput } from '../../../shared/number-input';
import { LabeledField } from '../../../shared/ui/LabeledField';
import { QueryState } from '../../../shared/ui/QueryState';
import { saveTolerances, useReceivingTolerances, useSettingsKeys, type ReceivingTolerances } from '../settings-api';
import { settingsFailure } from '../settings-error';
import styles from './AccessSettings.module.css';

export function ReceivingToleranceSettings() {
  const query = useReceivingTolerances();
  return <QueryState query={query}>{query.data && <ToleranceForm initial={query.data} />}</QueryState>;
}
function ToleranceForm({ initial }: { initial: ReceivingTolerances }) {
  const { t, i18n } = useTranslation();
  const query = useReceivingTolerances();
  const keys = useSettingsKeys();
  const cache = useQueryClient();
  const [saved, setSaved] = useState(initial);
  const [cbm, setCbm] = useState(initial.cbmTolerancePercent);
  const [weight, setWeight] = useState(initial.weightTolerancePercent);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<ReturnType<typeof settingsFailure>>();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const number = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 4 });
  const dirty = cbm !== saved.cbmTolerancePercent || weight !== saved.weightTolerancePercent;
  function reset(value: ReceivingTolerances) {
    setSaved(value); setCbm(value.cbmTolerancePercent); setWeight(value.weightTolerancePercent); setErrors({}); setFailure(undefined); setSuccess(false);
  }
  async function reload() {
    setBusy(true);
    try { const result = await query.refetch({ throwOnError: true }); if (result.data) reset(result.data); }
    catch (error) { setFailure(settingsFailure(error, t)); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const invalid: Record<string, string> = {};
    for (const [key, value] of [['cbm', cbm], ['weight', weight]]) {
      if (!/^\d{1,3}(\.\d{1,2})?$/.test(value) || Number(value) > 100) invalid[key] = t('percentInvalid');
    }
    setErrors(invalid); setSuccess(false);
    if (Object.keys(invalid).length) { requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-tolerance-form] [aria-invalid="true"]')?.focus()); return; }
    setBusy(true); setFailure(undefined);
    try {
      const result = await saveTolerances({ cbmTolerancePercent: cbm, weightTolerancePercent: weight, version: saved.version });
      reset(result); cache.setQueryData(keys.tolerances, result);
      await cache.invalidateQueries({ queryKey: keys.tolerances }); setSuccess(true);
    } catch (error) { setFailure(settingsFailure(error, t)); }
    finally { setBusy(false); }
  }
  return <div className={styles.toleranceLayout}>
    <form className={'surface ' + styles.card} onSubmit={save} noValidate data-tolerance-form>
      <div className={styles.heading}><div><h2>{t('receivingTolerances')}</h2><p className="muted-text">{t('toleranceHint')}</p></div></div>
      <div className={styles.cardBody}><fieldset className={styles.fields} disabled={busy}>
        <div className={styles.twoColumns}>{([
          { key: 'cbm', label: 'cbmTolerance', value: cbm, current: saved.cbmTolerancePercent, change: setCbm },
          { key: 'weight', label: 'weightTolerance', value: weight, current: saved.weightTolerancePercent, change: setWeight },
        ]).map(field => <div key={field.key}><LabeledField label={t(field.label)} error={errors[field.key]}>{props => <div className={styles.percent}><input {...props} inputMode="decimal" maxLength={8} value={field.value} onChange={event => { field.change(normalizeNumericInput(event.target.value)); setSuccess(false); }} /><span aria-hidden="true">%</span></div>}</LabeledField><p className={styles.current}>{t('currentTolerance', { value: number.format(Number(field.current)) })}</p></div>)}</div>
        <p className="muted-text">{t('percentRules')}</p><p className={styles.note}>{t('subsequentReceiptNote')}</p>
        {failure && <div className={styles.failure} role="alert"><p>{failure.message}</p>{failure.stale && <button type="button" className="button" onClick={() => void reload()}>{t('reloadLatest')}</button>}</div>}
        {success && <p role="status">{t('toleranceSaved')}</p>}
      </fieldset></div>
      <div className="office-dialog-actions"><button type="button" className="button" disabled={busy || !dirty} onClick={() => reset(saved)}>{t('discardChanges')}</button><button className="button button-primary" disabled={busy || !dirty || Boolean(failure?.stale)}>{t(busy ? 'saving' : 'save')}</button></div>
    </form>
    <aside className={'surface ' + styles.card}><div className={styles.heading}><div><h2>{t('toleranceExamples')}</h2><p className="muted-text">{t('toleranceExampleHint')}</p></div></div><div className={styles.cardBody}>
      <div className={styles.example}><strong>{t('cbmTolerance')} · {number.format(Number(saved.cbmTolerancePercent))}%</strong><p>{t('cbmExample', { value: number.format(Number(saved.cbmTolerancePercent) / 10) })}</p></div>
      <div className={styles.example}><strong>{t('weightTolerance')} · {number.format(Number(saved.weightTolerancePercent))}%</strong><p>{t('weightExample', { value: number.format(Number(saved.weightTolerancePercent)) })}</p></div><p className={styles.note}>{t('toleranceFindingNote')}</p>
    </div></aside>
  </div>;
}
