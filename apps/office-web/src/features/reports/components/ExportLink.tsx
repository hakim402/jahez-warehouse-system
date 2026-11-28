import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { reportFilters, type ReportFilters, type ReportKind } from '../report-types';

export function ExportLink({ kind, filters = {} }: { kind: ReportKind; filters?: ReportFilters }) {
  const { t } = useTranslation();
  const params = new URLSearchParams({ kind, ...reportFilters(kind, filters) });
  return <Link className="button" to={'/reports?' + params}>
    <Download size={16} aria-hidden="true" />{t('exportExcel')}
  </Link>;
}
