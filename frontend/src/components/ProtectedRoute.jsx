import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }) {
  const { token, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) return null;
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
