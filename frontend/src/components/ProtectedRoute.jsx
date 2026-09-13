import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }) {
  const { token, isReady } = useAuth();

  if (!isReady) return null;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
