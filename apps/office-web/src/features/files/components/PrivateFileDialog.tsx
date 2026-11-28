import { Download, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WarehouseScope } from '../../../app/use-warehouse-scope';
import { OfficeDialog } from '../../../shared/ui/OfficeDialog';
import { QueryState } from '../../../shared/ui/QueryState';
import { usePrivateFile } from '../files-api';
import styles from './PrivateFileDialog.module.css';

const fileExtensions: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
  'application/pdf': 'pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls', 'text/csv': 'csv',
};

export function PrivateFileDialog({ scope, fileId, name, onClose }: {
  scope: WarehouseScope; fileId: string; name: string; onClose: () => void;
}) {
  const { t } = useTranslation();
  const query = usePrivateFile(scope, fileId);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    setUrl(undefined);
    setPreviewFailed(false);
    if (!query.data) return;
    const objectUrl = URL.createObjectURL(query.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data]);
  const extension = query.data && fileExtensions[query.data.type];
  const filename = /\.[a-z0-9]{2,5}$/i.test(name) || !extension ? name : `${name}.${extension}`;
  return <OfficeDialog title={name} onClose={onClose} wide>
    <div className="office-dialog-body"><QueryState query={query}>
      {url && (query.data?.type.startsWith('image/') && !previewFailed ? <img className={styles.image} src={url} alt={name} onError={() => setPreviewFailed(true)} /> :
        <div className={styles.document}><FileText size={32} aria-hidden="true" /><p>{t('attachmentReady')}</p></div>)}
    </QueryState></div>
    {url && query.data && <div className="office-dialog-actions"><a className="button" href={url} download={filename}><Download size={16} aria-hidden="true" />{t('download')}</a></div>}
  </OfficeDialog>;
}
