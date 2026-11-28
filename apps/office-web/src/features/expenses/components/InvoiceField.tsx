import { Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LabeledField } from '../../../shared/ui/LabeledField';
import styles from './ExpenseDialog.module.css';

export const invoiceTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];

export function InvoiceField({ file, error, onChange }: { file: File | null; error?: string; onChange: (file: File | null) => void }) {
  const { t } = useTranslation();
  const [drag, setDrag] = useState(false);
  return <LabeledField label={t('invoiceEvidence')} error={error}>
    {(attributes) => <div>
      <input {...attributes} className={styles.fileInput} type="file" accept={invoiceTypes.join(',')}
        onChange={(event) => { onChange(event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ''; }} />
      <label htmlFor={attributes.id} className={styles.dropzone} data-drag={drag || undefined}
        onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(event) => { event.preventDefault(); setDrag(false); onChange(event.dataTransfer.files[0] ?? null); }}>
        <Upload size={18} aria-hidden="true" /><strong>{t('chooseFile')}</strong><span>{t('dragFileHere')}</span>
      </label>
      {file && <div className={styles.selectedFile}><span>{file.name}</span><button type="button" className="icon-button" aria-label={t('removeAttachment')} onClick={() => onChange(null)}><X size={16} aria-hidden="true" /></button></div>}
    </div>}
  </LabeledField>;
}
