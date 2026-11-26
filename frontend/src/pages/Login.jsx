import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { digitsOnly, groupPhone, phoneError } from '../utils/phone';
import { AuthSplitLayout, AuthSwitch } from '../components/AuthSplitLayout';
import { Banner, ErrorText, Heading, Label, PhoneBox, PrimaryButton, Rich, TextInput } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { msg } from '../i18n/strings';

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
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
    if (!password) errors.password = msg('Enter your password.');
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
      // Return to where the person was headed (for example a scanned pay link), but only inside this app.
      const from = location.state?.from;
      navigate(typeof from === 'string' && /^\/(?!\/)/.test(from) ? from : '/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthError(msg('Wrong phone number or password. Try again.'));
      } else {
        setAuthError(msg("Couldn't reach CeylonPay. Check your connection and try again."));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout
      action={<AuthSwitch onClick={() => navigate('/register')}>Create an account</AuthSwitch>}
      heroLabel={msg('Welcome back')}
      heroHeight={250}
    >
      <Heading size={28} style={{ margin: '4px 0 0' }}>
        <Rich text={t('Log in to [CeylonPay]')} />
      </Heading>
      {authError && <Banner>{authError}</Banner>}
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Phone number</Label>
          <PhoneBox
            value={groupPhone(phone)}
            onChange={(e) => {
              setPhone(digitsOnly(e.target.value));
              setFieldErrors((f) => ({ ...f, phone: '' }));
            }}
            autoComplete="tel-national"
          />
          <ErrorText>{fieldErrors.phone}</ErrorText>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Password</Label>
          <TextInput
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((f) => ({ ...f, password: '' }));
            }}
            autoComplete="current-password"
          />
          <ErrorText>{fieldErrors.password}</ErrorText>
        </div>
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </PrimaryButton>
      </form>
      <p style={{ margin: 0, textAlign: 'center', fontSize: 13.5, color: '#C9BCB0' }}>
        {t('New here?')} <Link to="/register">{t('Create a wallet')}</Link>
      </p>
    </AuthSplitLayout>
  );
}
