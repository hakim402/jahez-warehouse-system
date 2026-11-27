import { useId, type ReactNode } from 'react';

type FieldAttributes = {
  id: string;
  className: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
};

export function LabeledField({ label, error, hint, hiddenLabel, children }: {
  label: string;
  error?: string;
  hint?: string;
  hiddenLabel?: boolean;
  children: (attributes: FieldAttributes) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className={hiddenLabel ? 'sr-only' : undefined} htmlFor={id}>
        {label}{hint && <> <small>{hint}</small></>}
      </label>
      {children({
        id, className: 'text-input',
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? id + '-error' : undefined,
      })}
      {error && <span id={id + '-error'} className="field-error">{error}</span>}
    </div>
  );
}
