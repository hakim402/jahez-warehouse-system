import { Download, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivateFile, type OfficeFile } from '../../files/files-api';
import { useWarehouseScope } from '../../../app/use-warehouse-scope';
import { PrivateFileDialog } from '../../files/components/PrivateFileDialog';
import styles from './ReceiptEvidence.module.css';

export function ReceiptEvidence({ scope, files, loading, error, retry }: {
  scope: ReturnType<typeof useWarehouseScope>;
  files: OfficeFile[] | undefined;
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const { t } = useTranslation();
  if (loading) return <div className={styles.loading} role="status">{t('loadingRecords')}</div>;
  if (error) return <div className={styles.error} role="alert"><span>{t('evidenceLoadFailed')}</span><button type="button" className="button" onClick={retry}>{t('retry')}</button></div>;
  if (!files?.length) return <p className={styles.empty}>{t('noPhotoEvidence')}</p>;
  return <div className={styles.gallery}>{files.map((file) => <EvidenceItem key={file.id} scope={scope} file={file} />)}</div>;
}

function EvidenceItem({ scope, file }: { scope: ReturnType<typeof useWarehouseScope>; file: OfficeFile }) {
  const { t } = useTranslation();
  const query = usePrivateFile(scope, file.id);
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const image = file.contentType.startsWith('image/');
  const name = file.originalName || t('photoEvidence');
  useEffect(() => {
    setUrl(null);
    if (!query.data) return;
    const objectUrl = URL.createObjectURL(query.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data]);
  if (query.isError) return <div className={styles.error} role="alert"><span>{t('evidenceLoadFailed')}</span><button type="button" className="button" onClick={() => { void query.refetch(); }}>{t('retry')}</button></div>;
  if (!url) return <div className={styles.placeholder} role="status"><ImageIcon size={22} aria-hidden="true" /><span>{t('loadingRecords')}</span></div>;
  if (!image) return <a className={styles.file} href={url} download={file.originalName || undefined}><Download size={20} aria-hidden="true" /><span>{name}</span></a>;
  return <>
    <button type="button" className={styles.photo} onClick={() => setOpen(true)} aria-label={t('viewPhoto', { name })}>
      <img src={url} alt="" loading="lazy" /><span>{name}</span>
    </button>
    {open && <PrivateFileDialog scope={scope} fileId={file.id} name={name} onClose={() => setOpen(false)} />}
  </>;
}
