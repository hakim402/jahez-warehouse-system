import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { initLanguage } from './app/i18n';
import { restoreSession } from './app/session';
import './global.css';

await initLanguage();
void restoreSession();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
