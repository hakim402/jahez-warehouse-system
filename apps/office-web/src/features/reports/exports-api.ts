import { ApiError } from '../../api/client';
import { useQuery } from '@tanstack/react-query';
import { authenticatedBlob, authenticatedJson } from '../../app/session';
import type { WarehouseScope } from '../../app/use-warehouse-scope';
import type { ExportJob, ReportFilters, ReportKind } from './report-types';

export function useExportHistory(scope: WarehouseScope) {
  return useQuery({
    queryKey: scope.queryKey('exports'),
    enabled: Boolean(scope.warehouseId),
    queryFn: ({ signal }) => authenticatedJson<{ exports: ExportJob[] }>(
      '/exports?warehouseId=' + encodeURIComponent(scope.warehouseId!), { signal },
    ),
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: ({ state }) => {
      if (state.error instanceof ApiError && [401, 403, 404].includes(state.error.status)) return false;
      return state.data?.exports.some(job => job.status === 'queued' || job.status === 'processing') ? 3000 : false;
    },
  });
}

export function createExport(warehouseId: string, kind: ReportKind, filters: ReportFilters) {
  return authenticatedJson<ExportJob>('/exports', { method: 'POST', json: { warehouseId, kind, filters } });
}

export async function downloadExport(job: ExportJob, signal: AbortSignal) {
  const blob = await authenticatedBlob('/exports/' + encodeURIComponent(job.id) + '/file', { signal });
  if (signal.aborted) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = job.fileName?.replace(/[\\/]/g, '_') || job.id + '.xlsx';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
