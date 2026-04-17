import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import PlayerDashboard from './pages/PlayerDashboard';
import RefereeDashboard from './pages/RefereeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LiveDisplay from './pages/LiveDisplay';
import type { Role } from './types';

function RootRedirect() {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const destinations: Record<Role, string> = {
    PLAYER: '/player',
    REFEREE: '/referee',
    ADMIN: '/admin',
  };

  return <Navigate to={role ? destinations[role] : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/display/:id" element={<LiveDisplay />} />

      {/* Protected routes */}
      <Route
        path="/player"
        element={
          <ProtectedRoute requiredRole="PLAYER">
            <PlayerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/referee"
        element={
          <ProtectedRoute requiredRole="REFEREE">
            <RefereeDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Root: redirect based on role */}
      <Route path="/" element={<RootRedirect />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
