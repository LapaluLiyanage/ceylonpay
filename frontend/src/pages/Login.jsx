import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { digitsOnly, groupPhone, phoneError } from '../utils/phone';
import { FieldLabel, TextField, FieldError, PhoneField } from '../components/FormFields';
import { AuthErrorBanner } from '../components/AuthErrorBanner';
import { Button } from '../components/Button';
import { AuthSplitLayout } from '../components/AuthSplitLayout';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const errors = {};
    const pe = phoneError(phone);
    if (pe) errors.phone = pe;
    if (!password) errors.password = 'Enter your password.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setAuthError('');
      return;
    }

    setFieldErrors({});
    setAuthError('');
    setBusy(true);
    try {
      await login({ phone: digitsOnly(phone), password });
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthError('Wrong phone number or password. Try again.');
      } else {
        setAuthError("Couldn't reach CeylonPay. Check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout>
      <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 26, fontWeight: 500, letterSpacing: '-.02em' }}>
        Log in
      </h2>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(242,244,239,.5)' }}>Use the phone number on your wallet.</p>

      <AuthErrorBanner message={authError} />

      <form onSubmit={handleSubmit}>
        <FieldLabel>Phone number</FieldLabel>
        <PhoneField value={groupPhone(phone)} onChange={(e) => setPhone(digitsOnly(e.target.value))} />
        <FieldError>{fieldErrors.phone}</FieldError>

        <div style={{ marginTop: 18 }}>
          <FieldLabel>Password</FieldLabel>
          <TextField type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          <FieldError>{fieldErrors.password}</FieldError>
        </div>

        <Button type="submit" variant="primary" style={{ width: '100%', marginTop: 24 }}>
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p style={{ margin: '20px 0 0', fontSize: 14, color: 'rgba(242,244,239,.5)', textAlign: 'center' }}>
        New to CeylonPay? <Link to="/register">Create an account</Link>
      </p>
    </AuthSplitLayout>
  );
}
