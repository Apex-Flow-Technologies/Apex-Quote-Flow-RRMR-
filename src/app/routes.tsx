import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AppLayout } from '../components/layout/AppLayout';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RouteErrorScreen, PageLoader } from '../components/common/ErrorScreen';

// Each page is downloaded only when first opened (smaller, faster first load on phones).
function page<T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) {
  const Lazy = lazy(async () => ({ default: (await loader())[name] as ComponentType }));
  return (
    <Suspense fallback={<PageLoader />}>
      <Lazy />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/app" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorScreen />,
  },
  {
    path: '/app',
    element: <ProtectedRoute />,
    errorElement: <RouteErrorScreen />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorScreen />,
        children: [
          { index: true, element: page(() => import('../pages/dashboard/DashboardPage'), 'DashboardPage') },
          { path: 'quotations', element: page(() => import('../pages/quotations/QuotationsPage'), 'QuotationsPage') },
          { path: 'products', element: page(() => import('../pages/products/ProductsPage'), 'ProductsPage') },
          { path: 'customers', element: page(() => import('../pages/customers/CustomersPage'), 'CustomersPage') },
          { path: 'settings', element: page(() => import('../pages/settings/SettingsPage'), 'SettingsPage') },
          { path: 'users', element: page(() => import('../pages/users/UsersPage'), 'UsersPage') },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
