import { Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LabeledField } from '../../../shared/ui/LabeledField';
import styles from './InvoiceField.module.css';

export const invoiceTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];

export function validInvoiceFile(file: File) {
  return file.size > 0 && file.size <= 15 * 1024 * 1024 && invoiceTypes.includes(file.type);
}

export function InvoiceField({ file, error, disabled = false, onChange }: { file: File | null; error?: string; disabled?: boolean; onChange: (file: File | null) => void }) {
  const { t } = useTranslation();
  const [drag, setDrag] = useState(false);
  return <LabeledField label={t('invoiceEvidence')} error={error}>
    {(attributes) => <div>
      <input {...attributes} className={styles.fileInput} type="file" disabled={disabled} accept={invoiceTypes.join(',')}
        onChange={(event) => { onChange(event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ''; }} />
      <label htmlFor={attributes.id} className={styles.dropzone} data-drag={drag || undefined}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(event) => { event.preventDefault(); setDrag(false); if (!disabled) onChange(event.dataTransfer.files[0] ?? null); }}>
        <Upload size={18} aria-hidden="true" /><strong>{t('chooseFile')}</strong><span>{t('dragFileHere')}</span>
      </label>
      {file && <div className={styles.selectedFile}><span>{file.name}</span><button type="button" className="icon-button" aria-label={t('removeAttachment')} disabled={disabled} onClick={() => onChange(null)}><X size={16} aria-hidden="true" /></button></div>}
    </div>}
  </LabeledField>;
}
