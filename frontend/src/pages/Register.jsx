import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { digitsOnly, groupPhone, phoneError } from '../utils/phone';
import { AuthSplitLayout, AuthSwitch } from '../components/AuthSplitLayout';
import { Banner, ErrorText, Heading, Hint, Label, PhoneBox, PrimaryButton, Rich, TextInput } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { msg } from '../i18n/strings';

const NIC_PATTERN = /^(\d{12}|\d{9}[VX])$/;

export default function Register() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nic, setNic] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  function clear(field) {
    setFieldErrors((f) => ({ ...f, [field]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const errors = {};
    if (!name.trim()) errors.name = msg('Enter your full name, as on your NIC.');
    const pe = phoneError(phone);
    if (pe) errors.phone = pe;
    const nicValue = nic.trim().toUpperCase();
    if (!nicValue) errors.nic = msg('Enter your NIC number.');
    else if (!NIC_PATTERN.test(nicValue)) errors.nic = msg('NIC is 12 digits, or 9 digits ending in V.');
    if (password.length < 6) errors.password = msg('Use at least 6 characters for your password.');
    else if (password !== confirmPassword) errors.password = msg('The two passwords do not match.');

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setAuthError('');
      return;
    }

    setFieldErrors({});
    setAuthError('');
    setBusy(true);
    try {
      const session = await register({ name: name.trim(), phone: digitsOnly(phone), nic: nicValue, password });
      navigate(session.phoneVerified === false ? '/verify' : '/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setAuthError(err.message);
      } else {
        setAuthError(msg("Couldn't reach CeylonPay. Your account was not created — try again."));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout
      action={<AuthSwitch onClick={() => navigate('/login')}>Log in</AuthSwitch>}
      heroLabel={msg('Starts at Rs. 0.00 · no fees')}
    >
      <Heading size={28} style={{ margin: '4px 0 0' }}>
        <Rich text={t('Create your [wallet]')} />
      </Heading>
      {authError && <Banner>{authError}</Banner>}
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Full name</Label>
          <TextInput
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clear('name');
            }}
            placeholder="Nimali Perera"
            autoComplete="name"
          />
          <ErrorText>{fieldErrors.name}</ErrorText>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Phone number</Label>
          <PhoneBox
            value={groupPhone(phone)}
            onChange={(e) => {
              setPhone(digitsOnly(e.target.value));
              clear('phone');
            }}
            autoComplete="tel-national"
          />
          <ErrorText>{fieldErrors.phone}</ErrorText>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>NIC number</Label>
          <TextInput
            value={nic}
            onChange={(e) => {
              setNic(e.target.value);
              clear('nic');
            }}
            placeholder="200145601234"
            style={{ letterSpacing: '.04em' }}
          />
          <ErrorText>{fieldErrors.nic}</ErrorText>
          <Hint>Your NIC keeps the wallet in your name. It is never shown to anyone you pay.</Hint>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>Password</Label>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clear('password');
              }}
              autoComplete="new-password"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>Confirm</Label>
            <TextInput
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clear('password');
              }}
              autoComplete="new-password"
            />
          </div>
        </div>
        <ErrorText>{fieldErrors.password}</ErrorText>
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? 'Creating wallet…' : 'Create wallet'}
        </PrimaryButton>
      </form>
      <p style={{ margin: 0, textAlign: 'center', fontSize: 13.5, color: '#C9BCB0' }}>
        {t('Already have a wallet?')} <Link to="/login">{t('Log in')}</Link>
      </p>
    </AuthSplitLayout>
  );
}
