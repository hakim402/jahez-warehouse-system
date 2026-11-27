import { useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { ApiError } from '../../../../api/client';
import { OfficeAccessError, signIn, useSession } from '../../../../app/session';
import wordmark from '../../../../assets/jahez-wordmark.png';
import { LanguageMenu } from '../../../../shared/ui/LanguageMenu';
import styles from './SignInPage.module.css';

type SignInError = 'invalidLogin' | 'officeAccess' | 'unavailableLogin';

export function SignInPage() {
  const { t } = useTranslation();
  const { session, restoring } = useSession();
  const phoneInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [missing, setMissing] = useState({ phone: false, password: false });
  const [error, setError] = useState<SignInError>();

  if (restoring) return <main className="session-status" role="status">{t('loadingSession')}</main>;
  if (session) return <Navigate to="/" replace />;

  function clearFieldError(field: keyof typeof missing) {
    if (missing[field]) setMissing((current) => ({ ...current, [field]: false }));
    if (error) setError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const phone = phoneInput.current?.value.trim() ?? '';
    const password = passwordInput.current?.value ?? '';
    setMissing({ phone: !phone, password: !password });
    setError(undefined);
    if (!phone || !password) {
      (phone ? passwordInput : phoneInput).current?.focus();
      return;
    }

    setPending(true);
    try {
      await signIn(phone, password);
    } catch (failure) {
      if (failure instanceof OfficeAccessError) setError('officeAccess');
      else if (failure instanceof ApiError && failure.status === 401) setError('invalidLogin');
      else setError('unavailableLogin');
    } finally {
      setPending(false);
    }
  }

  const VisibilityIcon = showPassword ? EyeOff : Eye;

  return (
    <main className={styles.page + ' office-background'}>
      <div className={styles.language}><LanguageMenu showIcon={false} /></div>
      <section className={styles.card + ' surface'} aria-labelledby="sign-in-title">
        <header className={styles.heading}>
          <img src={wordmark} className={styles.logo} alt={t('office')} width="110" height="105" />
          <h1 id="sign-in-title">{t('signIn')}</h1>
          <p>{t('signInHelp')}</p>
        </header>
        <form className={styles.form} onSubmit={submit} noValidate aria-busy={pending}>
          <div className="field">
            <label htmlFor="phone">{t('phone')}</label>
            <input ref={phoneInput} id="phone" name="phone" className="text-input" type="tel"
              dir="ltr" autoComplete="username" required aria-invalid={missing.phone}
              onChange={() => clearFieldError('phone')}
              aria-describedby={missing.phone ? 'phone-error' : undefined} placeholder={t('phonePlaceholder')} />
            {missing.phone && <span id="phone-error" className="field-error">{t('phoneRequired')}</span>}
          </div>
          <div className="field">
            <label htmlFor="password">{t('password')}</label>
            <div className={styles.password}>
              <input ref={passwordInput} id="password" name="password" className="text-input"
                type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                required aria-invalid={missing.password} placeholder={t('passwordPlaceholder')}
                onChange={() => clearFieldError('password')}
                aria-describedby={missing.password ? 'password-error' : undefined} />
              <button type="button" className={styles.visibility + ' icon-button'}
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                onClick={() => setShowPassword((visible) => !visible)}>
                <VisibilityIcon size={19} aria-hidden="true" />
              </button>
            </div>
            {missing.password && <span id="password-error" className="field-error">{t('passwordRequired')}</span>}
          </div>
          {error && <p className="field-error" role="alert">{t(error)}</p>}
          <button type="submit" className="button button-primary" disabled={pending}>
            {t(pending ? 'signingIn' : 'signIn')}
          </button>
        </form>
      </section>
    </main>
  );
}
