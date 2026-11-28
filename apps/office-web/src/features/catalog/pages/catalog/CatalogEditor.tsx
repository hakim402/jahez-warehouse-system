import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { photoSource } from '../../../../shared/photo-source';
import { ApiError } from '../../../../api/client';
import { LabeledField } from '../../../../shared/ui/LabeledField';
import { OfficeDialog } from '../../../../shared/ui/OfficeDialog';
import { saveCatalogRecord, type Party, type PartyKind, type Product } from '../../catalog-api';
import styles from './CatalogPage.module.css';

export type CatalogEditorState = { kind: 'product'; record?: Product } | { kind: PartyKind; record?: Party };
export const catalogAction = {
  product: { add: 'addProduct', edit: 'editProduct' },
  supplier: { add: 'addSupplier', edit: 'editSupplier' },
  customer: { add: 'addCustomer', edit: 'editCustomer' },
} as const;

export function CatalogEditor({ editor, queryKey, onClose }: {
  editor: CatalogEditorState;
  queryKey: readonly unknown[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [failureDetails, setFailureDetails] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: (record: Parameters<typeof saveCatalogRecord>[0]) => saveCatalogRecord(record, editor.record?.id),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey });
      onClose();
    },
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const value = (key: string) => String(fields.get(key) ?? '').trim() || null;
    const formErrors: Record<string, string> = {};
    const record = editor.kind === 'product' ? {
      nameEn: value('nameEn'), nameAr: value('nameAr'), nameCn: value('nameCn'),
      modelNo: value('modelNo'), photoUrl: value('photoUrl'),
    } : {
      type: editor.kind,
      name: value('name') ?? '', nameCn: value('nameCn'), shippingMark: value('shippingMark'),
      phone: value('phone'), address: value('address'),
    };
    if ('type' in record) {
      if (!record.name) formErrors.name = 'nameRequired';
    } else {
      if (!record.nameEn && !record.nameAr && !record.nameCn) formErrors.nameEn = 'productNameRequired';
      if (record.photoUrl && !photoSource(record.photoUrl) &&
        (editor.kind !== 'product' || editor.record?.photoUrl !== record.photoUrl)) {
        formErrors.photoUrl = 'photoUrlInvalid';
      }
    }
    setErrors(formErrors);
    setFailure(undefined);
    setFailureDetails([]);
    if (Object.keys(formErrors).length) {
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    try {
      await mutation.mutateAsync(record);
    } catch (error) {
      setFailure(error instanceof ApiError && error.status === 403 ? 'restricted' :
        error instanceof ApiError && error.status === 409 ? 'conflict' :
          error instanceof ApiError && error.status === 400 ? 'validationFailed' : 'saveFailed');
      if (error instanceof ApiError && [400, 409].includes(error.status)) setFailureDetails(error.validationMessages);
    }
  }

  const fields = editor.kind === 'product' ? [
    ['nameEn', editor.record?.nameEn], ['nameAr', editor.record?.nameAr], ['nameCn', editor.record?.nameCn],
    ['modelNo', editor.record?.modelNo], ['photoUrl', editor.record?.photoUrl],
  ] : [
    ['name', editor.record?.name], ['nameCn', editor.record?.nameCn], ['shippingMark', editor.record?.shippingMark],
    ['phone', editor.record?.phone], ['address', editor.record?.address],
  ];
  const title = t(catalogAction[editor.kind][editor.record ? 'edit' : 'add']);

  return (
    <OfficeDialog title={title} onClose={onClose} busy={mutation.isPending}>
      <form onSubmit={submit} noValidate>
        <fieldset className={'office-dialog-body ' + styles.editorFields} disabled={mutation.isPending}>
          {fields.map(([field, initial]) => field && (
            <LabeledField key={field} label={t(field)} error={errors[field] && t(errors[field])}>
              {(props) => <input {...props} name={field} type={field === 'phone' ? 'tel' : 'text'}
                autoComplete="off" dir={field === 'photoUrl' ? 'ltr' : 'auto'} defaultValue={initial ?? ''} />}
            </LabeledField>
          ))}
          {failure && <p className={'field-error ' + styles.fullField} role="alert">{t(failure)}</p>}
          {failureDetails.length > 0 && <p className={'field-error ' + styles.fullField}>{failureDetails.join(' ')}</p>}
        </fieldset>
        <div className="office-dialog-actions">
          <button type="button" className="button" disabled={mutation.isPending} onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="button button-primary" disabled={mutation.isPending}>
            {t(mutation.isPending ? 'saving' : 'save')}
          </button>
        </div>
      </form>
    </OfficeDialog>
  );
}
