import { Routes, Route, Navigate } from 'react-router-dom';
import { ConnectPage } from './pages/ConnectPage';
import { TerminalPage } from './pages/TerminalPage';
import { useConnectionStore } from './stores/connectionStore';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<ConnectPage />} />
      <Route
        path="/terminal"
        element={
          <RequireAuth>
            <TerminalPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useConnectionStore((s) => s.status);
  if (status !== 'connected') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
