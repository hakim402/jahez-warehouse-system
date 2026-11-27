import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RecordState } from '../../../../shared/ui/RecordState';
import { exactCount } from '../../../stock/warehouse-api';
import { receiptSeries, useReceiptHistory } from './dashboard-data';
import styles from './DashboardPage.module.css';

export function DashboardCharts({ warehouseId }: { warehouseId: string }) {
  const { t, i18n } = useTranslation();
  const history = useReceiptHistory(warehouseId);
  const gradientId = useId();
  const language = i18n.resolvedLanguage || 'en';
  const series = history.data ? receiptSeries(history.data) : undefined;
  const date = (value: string) => new Date(value + 'T00:00:00Z').toLocaleDateString(language, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' });
  const error = history.isError || series?.tooLarge;
  const state = () => error
    ? <RecordState state="error" action={() => { void history.refetch(); }} />
    : <RecordState state="loading" />;
  return <>
    <section className={'surface workspace-panel ' + styles.chartPanel}>
      <div className={styles.panelHeader}><h2>{t('cartonsReceived')}</h2><span>{t('lastFourWeeks')}</span></div>
      {!series || error ? state() : <div className={styles.areaLayout}>
        <div className={styles.chartSummary}>
          <strong>{exactCount(series.total.toString(), language)}</strong><span>{t('cartonsReceived').toLocaleLowerCase(language)}</span>
          <small>{t('priorPeriod', { value: exactCount(series.prior.toString(), language) })}</small>
        </div>
        <div className={styles.areaChart}>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={series.days} margin={{ top: 10, right: 8, bottom: 0, left: -4 }}>
              <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#7b57fc" stopOpacity={0.24} /><stop offset="1" stopColor="#7b57fc" stopOpacity={0.02} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#e4ddf3" strokeDasharray="3 4" />
              <XAxis dataKey="date" tickFormatter={date} minTickGap={45} tick={{ fontSize: 11 }} axisLine={{ stroke: '#e4ddf3' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => new Intl.NumberFormat(language, { notation: 'compact' }).format(value)}
                axisLine={false} tickLine={false} width={48} />
              <Tooltip labelFormatter={(value) => date(String(value))} />
              <Area type="linear" name={t('previousPeriod')} dataKey="previous" stroke="#a89bc4" strokeDasharray="4 4" fill="transparent" isAnimationActive={false} />
              <Area type="linear" name={t('currentPeriod')} dataKey="current" stroke="#7044ed" fill={'url(#' + gradientId + ')'} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className={styles.legend}><span>{t('currentPeriod')}</span><span>{t('previousPeriod')}</span></div>
        </div>
      </div>}
    </section>
    <section className={'surface workspace-panel ' + styles.chartPanel}>
      <div className={styles.panelHeader}><h2>{t('receiptsByWeekday')}</h2><span>{t('lastFourWeeks')}</span></div>
      {!series || error ? state() : <div className={styles.barChart}>
        <ResponsiveContainer width="100%" height={176}>
          <BarChart data={series.weekdays.map((item) => ({ ...item, label: weekday.format(item.date) }))} margin={{ left: 0, right: 0, top: 12, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={{ stroke: '#e4ddf3' }} tickLine={false} interval={0} />
            <Tooltip /><Bar dataKey="count" name={t('receipt')} fill="#7b57fc" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>}
    </section>
  </>;
}
