import { lazy, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Direction } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { SignInPage } from '../features/auth/pages/sign-in/SignInPage';
import { DashboardPage } from '../features/dashboard/pages/overview/DashboardPage';
import { languages, officeLanguage } from './i18n';
import { OfficeShell } from './OfficeShell';
import { queryClient } from './query-client';
import { useSession, watchIdleSession } from './session';

const OrderListPage = lazy(() => import('../features/orders/pages/order-list/OrderListPage'));
const OrderDetailPage = lazy(() => import('../features/orders/pages/order-detail/OrderDetailPage'));
const OrderEditorPage = lazy(() => import('../features/orders/pages/order-editor/OrderEditorPage'));
const CatalogPage = lazy(() => import('../features/catalog/pages/catalog/CatalogPage'));

function RequireSession() {
  const { t } = useTranslation();
  const { restoring, session } = useSession();
  if (restoring) return <main className="session-status" role="status">{t('loadingSession')}</main>;
  return session ? <Outlet /> : <Navigate to="/sign-in" replace />;
}

export function App() {
  const { i18n } = useTranslation();
  const { restoring, session } = useSession();
  const activeSessionId = restoring ? undefined : session?.sessionId;
  useEffect(() => activeSessionId ? watchIdleSession() : undefined, [activeSessionId]);

  return (
    <QueryClientProvider client={queryClient}>
      <Direction.Provider dir={languages[officeLanguage(i18n.resolvedLanguage)].direction}>
        <BrowserRouter>
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route element={<RequireSession />}>
              <Route element={<OfficeShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="orders" element={<OrderListPage />} />
                <Route path="orders/new" element={<OrderEditorPage />} />
                <Route path="orders/:orderId" element={<OrderDetailPage />} />
                <Route path="orders/:orderId/edit" element={<OrderEditorPage />} />
                <Route path="catalog" element={<CatalogPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Direction.Provider>
    </QueryClientProvider>
  );
}
