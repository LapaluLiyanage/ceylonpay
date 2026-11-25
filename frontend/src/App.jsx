import { useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Deposit from './pages/Deposit';
import Transfer from './pages/Transfer';
import History from './pages/History';
import Safety from './pages/Safety';
import Admin from './pages/Admin';
import VerifyPhone from './pages/VerifyPhone';
import Receive from './pages/Receive';
import Welcome from './pages/Welcome';
import { Splash } from './components/Splash';
import { entryPath, markSplashSeen, shouldShowSplash } from './utils/firstRun';

const TOKEN_KEY = 'ceylonpay_token';

function readStorage(kind) {
  try {
    return window[kind];
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}

/** Where "/" and unknown addresses go: the dashboard, the intro slides, or log in. */
function Entry() {
  const local = readStorage('localStorage');
  const hasToken = !!local.getItem(TOKEN_KEY);
  return <Navigate to={entryPath({ local, hasToken })} replace />;
}

export default function App() {
  const [splash, setSplash] = useState(() =>
    shouldShowSplash({
      session: readStorage('sessionStorage'),
      hasToken: !!readStorage('localStorage').getItem(TOKEN_KEY),
      reducedMotion: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    })
  );
  const finishSplash = useCallback(() => {
    markSplashSeen(readStorage('sessionStorage'));
    setSplash(false);
  }, []);

  return (
    <LanguageProvider>
    <AuthProvider>
      <BrowserRouter>
        {splash && <Splash onDone={finishSplash} />}
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deposit"
            element={
              <ProtectedRoute>
                <Deposit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfer"
            element={
              <ProtectedRoute>
                <Transfer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />
          <Route
            path="/receive"
            element={
              <ProtectedRoute>
                <Receive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/safety"
            element={
              <ProtectedRoute>
                <Safety />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verify"
            element={
              <ProtectedRoute>
                <VerifyPhone />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Entry />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </LanguageProvider>
  );
}
