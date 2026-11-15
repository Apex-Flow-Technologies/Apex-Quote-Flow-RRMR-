import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { router } from './routes';
import { AppErrorBoundary } from '../components/common/ErrorScreen';
import { UpdateBanner } from '../components/common/UpdateBanner';

export const App: React.FC = () => {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
        <UpdateBanner />
      </AuthProvider>
    </AppErrorBoundary>
  );
};

export default App;
