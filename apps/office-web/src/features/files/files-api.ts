import { ApiError } from '../../api/client';
import type { WarehouseScope } from '../../app/use-warehouse-scope';
import { useQuery } from '@tanstack/react-query';
import { authenticatedBlob, authenticatedForm, authenticatedJson } from '../../app/session';
import { useWarehouseScope } from '../../app/use-warehouse-scope';

export type OfficeFile = {
  id: string;
  warehouseId: string;
  uploadId: string;
  purpose: string;
  entityType: string | null;
  entityId: string | null;
  provider: 'local' | 's3' | 'oss';
  originalName: string | null;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  takenAt: string | null;
  uploadedBy: string;
  createdAt: string;
};

export type FileFilters = {
  entityType?: 'receipt' | 'receipt_line';
  entityId?: string;
  purpose?: string;
};

export type FileUploadInput = {
  warehouseId: string;
  uploadId: string;
  purpose: string;
  file: File;
  entityType?: 'receipt' | 'receipt_line' | 'adjustment';
  entityId?: string;
  signal?: AbortSignal;
};

export function listOfficeFiles(warehouseId: string, filters: FileFilters, signal?: AbortSignal) {
  const query = new URLSearchParams({ warehouseId });
  if (filters.entityType) query.set('entityType', filters.entityType);
  if (filters.entityId) query.set('entityId', filters.entityId);
  if (filters.purpose) query.set('purpose', filters.purpose);
  return authenticatedJson<{ warehouseId: string; files: OfficeFile[] }>('/files?' + query, { signal });
}

export function uploadOfficeFile(input: FileUploadInput) {
  const form = new FormData();
  form.set('uploadId', input.uploadId);
  form.set('purpose', input.purpose);
  form.set('file', input.file);
  if (input.entityType && input.entityId) {
    form.set('entityType', input.entityType);
    form.set('entityId', input.entityId);
  }
  return authenticatedForm<OfficeFile>('/files?warehouseId=' + encodeURIComponent(input.warehouseId), form, {
    signal: input.signal,
  });
}

export function fetchOfficeFile(fileId: string, signal?: AbortSignal) {
  return authenticatedBlob('/files/' + encodeURIComponent(fileId) + '/content', { signal });
}

export function usePrivateFile(scope: ReturnType<typeof useWarehouseScope>, fileId: string, enabled = true) {
  return useQuery({
    queryKey: scope.queryKey('file-content', fileId),
    enabled: enabled && scope.canRead && Boolean(fileId),
    queryFn: ({ signal }) => fetchOfficeFile(fileId, signal),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60_000,
  });
}

export function useOfficeFile(scope: WarehouseScope, fileId: string) {
  return useQuery({
    queryKey: scope.queryKey('file-metadata', fileId),
    enabled: Boolean(scope.warehouseId && fileId),
    queryFn: async ({ signal }) => {
      const file = await authenticatedJson<OfficeFile>('/files/' + encodeURIComponent(fileId), { signal });
      if (file.warehouseId !== scope.warehouseId) throw new ApiError(404);
      return file;
    },
  });
}
