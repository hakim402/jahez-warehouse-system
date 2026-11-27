import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LabeledField } from '../../../../shared/ui/LabeledField';
import { useRecordFormat } from '../../../../shared/format-record';
import { productName, type Product } from '../../../catalog/catalog-api';
import styles from '../../components/OrderWorkspace.module.css';
import type { DraftLine, validateDraft } from './order-draft';

type InputKey = 'productId' | 'cartons' | 'qtyPerCarton' | 'unitPrice';

export function OrderLineEditor({ lines, estimates, products, showErrors, updateLine, addLine, removeLine }: {
  lines: DraftLine[];
  estimates: ReturnType<typeof validateDraft>['lines'];
  products: Product[];
  showErrors: boolean;
  updateLine: (key: string, field: InputKey, value: string) => void;
  addLine: () => void;
  removeLine: (key: string) => void;
}) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const numberFields = [
    { field: 'cartons', label: 'cartons' },
    { field: 'qtyPerCarton', label: 'unitsPerCarton' },
    { field: 'unitPrice', label: 'unitPrice' },
  ] as const;

  return (
    <section className="surface workspace-panel" aria-labelledby="edit-line-items">
      <h2 id="edit-line-items" className="panel-heading">{t('lineItems')}</h2>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={t('lineItems')}>
        <table className={'records-table ' + styles.editorRows}>
          <thead><tr>
            {['product', 'cartons', 'unitsPerCarton', 'units', 'unitPrice', 'amount', ''].map((column) => (
              <th scope="col" key={column}>{column ? t(column) : <span className="sr-only">{t('edit')}</span>}</th>
            ))}
          </tr></thead>
          <tbody>{lines.map((line, index) => {
            const number = format.quantity(index + 1);
            const estimate = estimates[index];
            const errors = showErrors ? estimate.errors : {};
            const label = (field: string) => t('lineField', { field: t(field), number });
            const input = ({ field, label: fieldLabel }: (typeof numberFields)[number]) => (
              <td key={field}>
                <LabeledField hiddenLabel label={label(fieldLabel)} error={errors[field] && t(errors[field])}>
                  {(props) => <input {...props} dir="ltr" inputMode={field === 'unitPrice' ? 'decimal' : 'numeric'}
                    value={line[field]} onChange={(event) => updateLine(line.key, field, event.currentTarget.value)} />}
                </LabeledField>
              </td>
            );
            const selectedProductMissing = line.productId && !products.some((product) => product.id === line.productId);
            return (
              <tr key={line.key}>
                <td>
                  <LabeledField hiddenLabel label={label('product')} error={errors.productId && t(errors.productId)}>
                    {(props) => <select {...props} required value={line.productId}
                      onChange={(event) => updateLine(line.key, 'productId', event.currentTarget.value)}>
                      <option value="">{t('chooseProduct')}</option>
                      {selectedProductMissing && <option value={line.productId}>{line.productId}</option>}
                      {products.map((product) => <option key={product.id} value={product.id}>
                        {productName(product, format.language) || product.modelNo || product.id}
                      </option>)}
                    </select>}
                  </LabeledField>
                </td>
                {input(numberFields[0])}
                {input(numberFields[1])}
                <td><bdi>{format.quantity(estimate.qty)}</bdi></td>
                {input(numberFields[2])}
                <td>
                  <bdi>{format.amount(estimate.amount === null ? null : Number(estimate.amount) / 100)}</bdi>
                  {errors.amount && <p className="field-error">{t(errors.amount)}</p>}
                </td>
                <td>
                  <button type="button" className="icon-button" aria-label={t('removeLine', { number })}
                    disabled={lines.length === 1} onClick={() => removeLine(line.key)}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <div className={styles.rowFooter}>
        <button type="button" className={'button ' + styles.addLine} onClick={addLine}>
          <Plus size={16} aria-hidden="true" />{t('addLine')}
        </button>
      </div>
    </section>
  );
}
