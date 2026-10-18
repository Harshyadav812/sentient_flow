import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CanvasPage } from '@/pages/CanvasPage';
import { ExecutionsPage } from '@/pages/ExecutionsPage';
import { CredentialsPage } from '@/pages/CredentialsPage';
import { SettingsLayout } from '@/pages/settings/SettingsLayout';
import { AccountSettings } from '@/pages/settings/AccountSettings';
import { SecuritySettings } from '@/pages/settings/SecuritySettings';
import { NotificationSettings } from '@/pages/settings/NotificationSettings';
import { GeneralSettings } from '@/pages/settings/GeneralSettings';
import { ReactFlowProvider } from '@xyflow/react';
import { AppLayout } from '@/components/layout/AppLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            fontSize: 13,
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected layout wraps the dashboard, executions, and other main pages */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/executions" element={<ExecutionsPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="account" replace />} />
            <Route path="account" element={<AccountSettings />} />
            <Route path="security" element={<SecuritySettings />} />
            <Route path="notifications" element={<NotificationSettings />} />
            <Route path="general" element={<GeneralSettings />} />
            <Route path="*" element={<Navigate to="account" replace />} />
          </Route>
          <Route
            path="/canvas/:id"
            element={
              <ReactFlowProvider>
                <CanvasPage />
              </ReactFlowProvider>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
