import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { digitsOnly, groupPhone, phoneError } from '../utils/phone';
import { FieldLabel, TextField, FieldError, PhoneField } from '../components/FormFields';
import { AuthErrorBanner } from '../components/AuthErrorBanner';
import { Button } from '../components/Button';
import { AuthSplitLayout } from '../components/AuthSplitLayout';

const NIC_PATTERN = /^(\d{12}|\d{9}[VX])$/;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nic, setNic] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const errors = {};
    if (!name.trim()) errors.name = 'Enter your full name, as on your NIC.';
    const pe = phoneError(phone);
    if (pe) errors.phone = pe;
    const nicValue = nic.trim().toUpperCase();
    if (!nicValue) errors.nic = 'Enter your NIC number.';
    else if (!NIC_PATTERN.test(nicValue)) errors.nic = 'NIC is 12 digits, or 9 digits ending in V.';
    if (password.length < 6) errors.password = 'Use at least 6 characters for your password.';
    else if (password !== confirmPassword) errors.password = 'The two passwords do not match.';

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setAuthError('');
      return;
    }

    setFieldErrors({});
    setAuthError('');
    setBusy(true);
    try {
      await register({ name: name.trim(), phone: digitsOnly(phone), nic: nicValue, password });
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setAuthError(err.message);
      } else {
        setAuthError("Couldn't reach CeylonPay. Your account was not created — try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout>
      <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 26, fontWeight: 500, letterSpacing: '-.02em' }}>
        Create your wallet
      </h2>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(242,244,239,.5)' }}>
        Your NIC keeps the wallet in your name. It is never shown to anyone you pay.
      </p>

      <AuthErrorBanner message={authError} />

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <FieldLabel>Full name</FieldLabel>
            <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="Nimali Perera" />
            <FieldError>{fieldErrors.name}</FieldError>
          </div>
          <div>
            <FieldLabel>Phone number</FieldLabel>
            <PhoneField value={groupPhone(phone)} onChange={(e) => setPhone(digitsOnly(e.target.value))} />
            <FieldError>{fieldErrors.phone}</FieldError>
          </div>
          <div>
            <FieldLabel>NIC number</FieldLabel>
            <TextField value={nic} onChange={(e) => setNic(e.target.value.toUpperCase().slice(0, 12))} placeholder="200145601234" />
            <FieldError>{fieldErrors.nic}</FieldError>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 150px', minWidth: 0 }}>
              <FieldLabel>Password</FieldLabel>
              <TextField type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div style={{ flex: '1 1 150px', minWidth: 0 }}>
              <FieldLabel>Confirm</FieldLabel>
              <TextField type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <FieldError>{fieldErrors.password}</FieldError>
        </div>

        <Button type="submit" variant="primary" style={{ width: '100%', marginTop: 24 }}>
          {busy ? 'Creating wallet…' : 'Create wallet'}
        </Button>
      </form>

      <p style={{ margin: '20px 0 0', fontSize: 14, color: 'rgba(242,244,239,.5)', textAlign: 'center' }}>
        Already have a wallet? <Link to="/login">Log in</Link>
      </p>
    </AuthSplitLayout>
  );
}
